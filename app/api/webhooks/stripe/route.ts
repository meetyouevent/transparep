import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { stripe } from '@/lib/stripe'
import { createServiceClient } from '@/lib/supabase/server'
import type Stripe from 'stripe'

export async function POST(request: Request) {
  const body = await request.text()
  const signature = headers().get('stripe-signature')

  if (!signature) {
    return NextResponse.json({ error: 'Missing signature' }, { status: 400 })
  }

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, signature, process.env.STRIPE_WEBHOOK_SECRET!)
  } catch (err) {
    return NextResponse.json({ error: `Webhook error: ${err}` }, { status: 400 })
  }

  const supabase = createServiceClient()

  const getSupabaseUserId = (metadata?: Stripe.Metadata | null) =>
    metadata?.supabase_user_id ?? null

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session
      const userId = getSupabaseUserId(session.metadata)
      if (userId) {
        await supabase
          .from('profiles')
          .update({ role: 'editor', subscription_status: 'active' })
          .eq('id', userId)
      }
      break
    }

    case 'customer.subscription.updated': {
      const subscription = event.data.object as Stripe.Subscription
      const userId = getSupabaseUserId(subscription.metadata)
      if (userId) {
        const status = subscription.status === 'active' ? 'active' : 'past_due'
        await supabase
          .from('profiles')
          .update({ subscription_status: status })
          .eq('id', userId)
      }
      break
    }

    case 'customer.subscription.deleted': {
      const subscription = event.data.object as Stripe.Subscription
      const userId = getSupabaseUserId(subscription.metadata)
      if (userId) {
        await supabase
          .from('profiles')
          .update({ role: 'reader', subscription_status: 'canceled' })
          .eq('id', userId)
      }
      break
    }

    default:
      break
  }

  return NextResponse.json({ received: true })
}
