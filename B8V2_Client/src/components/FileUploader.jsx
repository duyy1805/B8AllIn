import { useState } from 'react';
import { Button, Spin, Upload, message } from 'antd';
import { UploadOutlined } from '@ant-design/icons';
import { uploadFile, attachProcessFile, attachProductDocumentFile } from '../api/file.api';
import { showMailNotification } from '../utils/mailNotification';

export default function FileUploader({ processVersionId, productDocumentVersionId, onUploaded }) {
  const [isProcessing, setIsProcessing] = useState(false);

  const customRequest = async ({ file, onSuccess, onError }) => {
    if (isProcessing) return;
    setIsProcessing(true);
    try {
      const uploaded = await uploadFile(file);
      let attached;
      if (processVersionId) attached = await attachProcessFile(processVersionId, uploaded.Id, 'PDF');
      else if (productDocumentVersionId) attached = await attachProductDocumentFile(productDocumentVersionId, uploaded.Id, 'PDF');
      else throw new Error('Không xác định phiên bản cần gắn file.');
      message.success('Đã tải PDF lên và đưa phiên bản vào hiệu lực');
      showMailNotification(attached?.mailSummary);
      onSuccess(uploaded);
      onUploaded?.(uploaded);
    } catch (e) {
      message.error(e.response?.data?.message || e.message);
      onError(e);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <>
      <Upload customRequest={customRequest} showUploadList={false} accept=".pdf" disabled={isProcessing}>
        <Button icon={<UploadOutlined />} loading={isProcessing} disabled={isProcessing}>
          {isProcessing ? 'Đang xử lý...' : 'Upload PDF'}
        </Button>
      </Upload>
      {isProcessing && <Spin fullscreen size="large" tip="Đang tải tài liệu và gửi email thông báo..." />}
    </>
  );
}
