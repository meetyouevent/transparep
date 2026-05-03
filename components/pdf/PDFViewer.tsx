'use client'

import { useState, useCallback } from 'react'
import { Document, Page, pdfjs } from 'react-pdf'
import 'react-pdf/dist/Page/AnnotationLayer.css'
import 'react-pdf/dist/Page/TextLayer.css'
import { Button } from '@/components/ui/button'
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Loader2 } from 'lucide-react'

// Set worker source
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.js`

interface PDFViewerProps {
  pdfUrl: string
  watermarkEmail?: string
}

export function PDFViewer({ pdfUrl, watermarkEmail }: PDFViewerProps) {
  const [numPages, setNumPages] = useState<number>(0)
  const [currentPage, setCurrentPage] = useState(1)
  const [scale, setScale] = useState(1.0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const onDocumentLoadSuccess = useCallback(({ numPages }: { numPages: number }) => {
    setNumPages(numPages)
    setLoading(false)
  }, [])

  const onDocumentLoadError = useCallback((err: Error) => {
    setError(err.message)
    setLoading(false)
  }, [])

  const goToPrev = () => setCurrentPage((p) => Math.max(1, p - 1))
  const goToNext = () => setCurrentPage((p) => Math.min(numPages, p + 1))
  const zoomIn = () => setScale((s) => Math.min(2.0, s + 0.2))
  const zoomOut = () => setScale((s) => Math.max(0.5, s - 0.2))

  if (error) {
    return (
      <div className="flex items-center justify-center h-64 bg-gray-50 rounded-lg">
        <p className="text-sm text-red-500">Impossible de charger le PDF: {error}</p>
      </div>
    )
  }

  return (
    <div className="pdf-viewer-container flex flex-col items-center">
      {/* Controls */}
      <div className="sticky top-0 z-20 w-full bg-white border-b flex items-center justify-between px-4 py-2 shadow-sm">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={goToPrev} disabled={currentPage <= 1}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm text-gray-700 min-w-[80px] text-center">
            {loading ? '...' : `${currentPage} / ${numPages}`}
          </span>
          <Button variant="outline" size="sm" onClick={goToNext} disabled={currentPage >= numPages}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={zoomOut} disabled={scale <= 0.5}>
            <ZoomOut className="h-4 w-4" />
          </Button>
          <span className="text-sm text-gray-700 w-12 text-center">{Math.round(scale * 100)}%</span>
          <Button variant="outline" size="sm" onClick={zoomIn} disabled={scale >= 2.0}>
            <ZoomIn className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* PDF Content */}
      <div className="relative mt-4 shadow-lg">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-white z-10">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        )}

        <Document
          file={pdfUrl}
          onLoadSuccess={onDocumentLoadSuccess}
          onLoadError={onDocumentLoadError}
          loading={null}
        >
          <div className="relative">
            <Page
              pageNumber={currentPage}
              scale={scale}
              renderTextLayer={false}
              renderAnnotationLayer={false}
            />
            {/* Watermark overlay */}
            {watermarkEmail && (
              <div className="pdf-watermark">
                <div
                  className="pdf-watermark-text"
                  style={{
                    backgroundImage: `repeating-linear-gradient(
                      -45deg,
                      transparent,
                      transparent 80px,
                      rgba(0,0,0,0) 80px,
                      rgba(0,0,0,0) 160px
                    )`,
                  }}
                >
                  {watermarkEmail} — ManuscritPro — {watermarkEmail}
                </div>
              </div>
            )}
          </div>
        </Document>
      </div>

      {/* Bottom nav */}
      {numPages > 1 && (
        <div className="mt-4 flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={goToPrev} disabled={currentPage <= 1}>
            <ChevronLeft className="h-4 w-4" />
            Précédent
          </Button>
          <span className="text-sm text-muted-foreground">Page {currentPage} sur {numPages}</span>
          <Button variant="outline" size="sm" onClick={goToNext} disabled={currentPage >= numPages}>
            Suivant
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  )
}
