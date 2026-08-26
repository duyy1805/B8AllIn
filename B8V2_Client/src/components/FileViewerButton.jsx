import { useEffect, useState } from 'react';
import { Button, Modal, Spin, message } from 'antd';
import { Eye } from 'lucide-react';
import { getFileBlob } from '../api/file.api';
import { getProcessVersionDetail } from '../api/process.api';

export default function FileViewerButton({ file, processVersionId, block = false, label = 'Xem PDF', buttonProps = {}, onOpened }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [fileUrl, setFileUrl] = useState(null);
  const [activeFile, setActiveFile] = useState(file || null);

  useEffect(() => () => {
    if (fileUrl) URL.revokeObjectURL(fileUrl);
  }, [fileUrl]);

  const showFile = async (event) => {
    event?.stopPropagation();
    setLoading(true);
    try {
      let targetFile = file;
      if (!targetFile && processVersionId) {
        const detail = await getProcessVersionDetail(processVersionId);
        const versionFiles = detail.files || [];
        targetFile = versionFiles.find(item => ['PDF', 'SIGNED'].includes(item.FileRole)) || versionFiles[0];
      }
      if (!targetFile) {
        message.warning('Phiên bản này chưa có file để xem.');
        return;
      }

      const blob = await getFileBlob(targetFile.FileId);
      if (fileUrl) URL.revokeObjectURL(fileUrl);
      setActiveFile(targetFile);
      setFileUrl(URL.createObjectURL(blob));
      setOpen(true);
      if (onOpened) {
        Promise.resolve(onOpened(targetFile)).catch(() => {
          message.warning('Tài liệu đã mở nhưng hệ thống chưa ghi nhận trạng thái đã xem.');
        });
      }
    } catch (error) {
      message.error(error.response?.data?.message || 'Không thể mở file.');
    } finally {
      setLoading(false);
    }
  };

  return <>
    <Button {...buttonProps} block={block} icon={<Eye size={16} />} loading={loading} onClick={showFile}>
      {label}
    </Button>
    <Modal
      title={activeFile?.OriginalName || 'Xem tài liệu'}
      open={open}
      onCancel={() => setOpen(false)}
      footer={null}
      width="min(1100px, 94vw)"
      destroyOnClose
      className="pdf-viewer-modal"
    >
      {fileUrl ? <iframe title={activeFile?.OriginalName || 'PDF'} src={fileUrl} /> : <Spin />}
    </Modal>
  </>;
}
