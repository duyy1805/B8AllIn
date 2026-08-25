import { Button, Upload, message } from 'antd';
import { UploadOutlined } from '@ant-design/icons';
import { uploadFile, attachProcessFile } from '../api/file.api';

export default function FileUploader({ processVersionId, onUploaded }) {
  const customRequest = async ({ file, onSuccess, onError }) => {
    try {
      const uploaded = await uploadFile(file);
      await attachProcessFile(processVersionId, uploaded.Id, 'PDF');
      message.success('Đã tải PDF lên và đưa phiên bản vào hiệu lực');
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
