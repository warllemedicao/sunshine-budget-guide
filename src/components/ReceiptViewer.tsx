import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { FileText, ExternalLink, X } from 'lucide-react';
import { useReceipts } from '@/hooks/useReceipts';

interface ReceiptViewerProps {
  filePath: string;
  fileName?: string;
  onRemove?: () => void;
}

export const ReceiptViewer = ({ filePath, fileName, onRemove }: ReceiptViewerProps) => {
  const { getReceiptUrl } = useReceipts();
  const [url, setUrl] = useState('');

  useEffect(() => {
    if (filePath) {
      getReceiptUrl(filePath).then(setUrl);
    }
  }, [filePath, getReceiptUrl]);

  return (
    <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
      <FileText className="h-5 w-5 text-blue-600 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate text-gray-800">{fileName || 'Comprovante'}</p>
        <p className="text-xs text-gray-500">Comprovante enviado</p>
      </div>
      <div className="flex gap-1 flex-shrink-0">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => window.open(url, '_blank')}
          title="Visualizar comprovante"
        >
          <ExternalLink className="h-4 w-4" />
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
