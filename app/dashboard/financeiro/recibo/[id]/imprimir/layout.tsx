export default function ReciboImprimirLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <style>{`
        @page { size: A4; margin: 16mm; }
        @media print {
          body * { visibility: hidden; }
          .receipt-print-root, .receipt-print-root * { visibility: visible; }
          .receipt-print-root { position: absolute; left: 0; top: 0; width: 100%; }
        }
      `}</style>
      <div className="receipt-print-root min-h-screen bg-white">{children}</div>
    </>
  );
}
