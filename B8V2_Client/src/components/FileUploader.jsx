import { Button, Upload, message } from 'antd';
import { UploadOutlined } from '@ant-design/icons';
import { uploadFile, attachProcessFile, attachProductDocumentFile } from '../api/file.api';

export default function FileUploader({ processVersionId, productDocumentVersionId, onUploaded }) {
  const customRequest = async ({ file, onSuccess, onError }) => {
    try {
      const uploaded = await uploadFile(file);
      let attached;
      if (processVersionId) attached = await attachProcessFile(processVersionId, uploaded.Id, 'PDF');
      else if (productDocumentVersionId) attached = await attachProductDocumentFile(productDocumentVersionId, uploaded.Id, 'PDF');
      else throw new Error('Không xác định phiên bản cần gắn file.');
      message.success('Đã tải PDF lên và đưa phiên bản vào hiệu lực');
      if (attached?.mailSummary?.failed) message.warning(`Tài liệu đã có hiệu lực nhưng ${attached.mailSummary.failed} email gửi thất bại. ADMIN có thể gửi lại trong Thông báo email.`);
      onSuccess(uploaded);
      onUploaded?.(uploaded);
    } catch (e) {
      message.error(e.response?.data?.message || e.message);
      onError(e);
    }
  };

  return (
    <Upload customRequest={customRequest} showUploadList={false} accept=".pdf">
      <Button icon={<UploadOutlined />}>Upload PDF</Button>
    </Upload>
  );
}
