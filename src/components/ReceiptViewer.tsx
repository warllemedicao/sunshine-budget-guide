import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { ExternalLink, FileText, X } from 'lucide-react';
import { useReceipts } from '@/hooks/useReceipts';

interface ReceiptViewerProps {
  filePath: string;
  fileName?: string;
  onRemove?: () => void;
}

export const ReceiptViewer = ({ filePath, fileName, onRemove }: ReceiptViewerProps) => {
  const { getReceiptUrl } = useReceipts();
  const [url, setUrl] = useState('');
  const [resolvingUrl, setResolvingUrl] = useState(false);

  useEffect(() => {
    if (!filePath) {
      setUrl('');
      return;
    }

    let cancelled = false;
    setResolvingUrl(true);

    getReceiptUrl(filePath)
      .then((nextUrl) => {
        if (!cancelled) setUrl(nextUrl || '');
      })
      .finally(() => {
        if (!cancelled) setResolvingUrl(false);
      });

    return () => {
      cancelled = true;
    };
  }, [filePath, getReceiptUrl]);

  return (
    <div className="space-y-2 rounded-lg border border-blue-200 bg-blue-50 p-3">
      <div className="flex items-center gap-3">
        <FileText className="h-5 w-5 flex-shrink-0 text-blue-600" />
        <div className="flex-1 min-w-0">
          <p className="truncate text-sm font-medium text-gray-800">{fileName || 'Comprovante'}</p>
          <p className="text-xs text-gray-500">Comprovante enviado</p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={!url || resolvingUrl}
          onClick={() => window.open(url, '_blank', 'noopener,noreferrer')}
          title="Abrir comprovante"
        >
          <ExternalLink className="mr-1 h-4 w-4" />
          {resolvingUrl ? 'Preparando...' : 'Abrir comprovante'}
        </Button>

        {onRemove && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onRemove}
            className="text-red-500 hover:text-red-700"
            title="Remover comprovante"
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
};
