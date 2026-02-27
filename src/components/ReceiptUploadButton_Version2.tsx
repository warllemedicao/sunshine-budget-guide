import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Upload, X } from 'lucide-react';
import { useReceipts } from '@/hooks/useReceipts';

interface ReceiptUploadButtonProps {
  transactionId: string;
  onUploadSuccess?: (filePath: string, fileName: string) => void;
}

export const ReceiptUploadButton = ({
  transactionId,
  onUploadSuccess,
}: ReceiptUploadButtonProps) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { uploadReceipt, loading } = useReceipts();

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validar tipo de arquivo (imagens e PDFs)
      const validTypes = ['image/jpeg', 'image/png', 'application/pdf'];
      if (!validTypes.includes(file.type)) {
        alert('Por favor, selecione uma imagem (JPG, PNG) ou PDF');
        return;
      }
      // Validar tamanho (máx 5MB)
      if (file.size > 5 * 1024 * 1024) {
        alert('Arquivo muito grande. Máximo 5MB');
        return;
      }
      setSelectedFile(file);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) return;
    const filePath = await uploadReceipt(selectedFile, transactionId);
    if (filePath) {
      onUploadSuccess?.(filePath, selectedFile.name);
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div className="flex flex-col gap-2 p-3 bg-gray-50 rounded-lg border border-gray-200">
      <Input
        ref={fileInputRef}
        type="file"
        accept="image/*,.pdf"
        onChange={handleFileSelect}
        disabled={loading}
        className="hidden"
      />
      
      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => fileInputRef.current?.click()}
          disabled={loading}
        >
          <Upload className="h-4 w-4 mr-2" />
          Selecionar Comprovante
        </Button>
        
        {selectedFile && (
          <>
            <span className="text-sm text-gray-600 truncate flex items-center">
              {selectedFile.name}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setSelectedFile(null);
                if (fileInputRef.current) fileInputRef.current.value = '';
              }}
            >
              <X className="h-4 w-4" />
            </Button>
          </>
        )}
      </div>
      
      {selectedFile && (
        <Button
          type="button"
          onClick={handleUpload}
          disabled={loading}
          className="w-full"
        >
          {loading ? 'Salvando...' : 'Fazer Upload do Comprovante'}
        </Button>
      )}
    </div>
  );
};