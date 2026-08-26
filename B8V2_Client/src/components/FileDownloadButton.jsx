import { useState } from 'react';
import { Button, message } from 'antd';
import { Download } from 'lucide-react';
import { downloadFileBlob } from '../api/file.api';

export default function FileDownloadButton({ file, label = 'Tải xuống', buttonProps = {} }) {
  const [loading, setLoading] = useState(false);
  const download = async event => {
    event?.stopPropagation();
    setLoading(true);
    try {
      const blob = await downloadFileBlob(file.FileId);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = file.OriginalName || `file-${file.FileId}`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      message.error(error.response?.data?.message || 'Không thể tải file.');
    } finally {
      setLoading(false);
    }
  };
  return <Button {...buttonProps} icon={<Download size={16} />} loading={loading} onClick={download}>{label}</Button>;
}
