import { Button } from '@/components/ui/button';
import { FileText, Download, Trash2 } from 'lucide-react';
import { useReceipts } from '@/hooks/useReceipts';
import { useState, useEffect } from 'react';

interface ReceiptViewerProps {
  filePath: string;
  fileName: string;
  receiptId?: string;
  onDelete?: () => void;
}

export const ReceiptViewer = ({
  filePath,
  fileName,
  receiptId,
  onDelete,
}: ReceiptViewerProps) => {
  const [publicUrl, setPublicUrl] = useState<string>('');
  const { getReceiptUrl, deleteReceipt } = useReceipts();

  useEffect(() => {
    const loadUrl = async () => {
      const url = await getReceiptUrl(filePath);
      setPublicUrl(url);
    };
    loadUrl();
  }, [filePath, getReceiptUrl]);

  const handleDelete = async () => {
    if (receiptId && confirm('Deseja deletar este comprovante?')) {
      const success = await deleteReceipt(receiptId);
      if (success) onDelete?.();
    }
  };

  return (
    <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
      <FileText className="h-5 w-5 text-blue-600 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate text-gray-800">{fileName}</p>
        <p className="text-xs text-gray-500">Comprovante enviado</p>
      </div>
      <div className="flex gap-2 flex-shrink-0">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => window.open(publicUrl, '_blank')}
          title="Visualizar comprovante"
        >
          <Download className="h-4 w-4" />
        </Button>
        {receiptId && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDelete}
            className="text-red-500 hover:text-red-700"
            title="Deletar comprovante"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
};