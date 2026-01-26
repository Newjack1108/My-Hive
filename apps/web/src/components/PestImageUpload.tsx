import { useState, useRef } from 'react';
import { api } from '../utils/api';
import './PestImageUpload.css';

interface PestImageUploadProps {
  pestId: string;
  imageUrl?: string | null;
  onImageChange: () => void;
}

export default function PestImageUpload({
  pestId,
  imageUrl,
  onImageChange,
}: PestImageUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('Please select an image file');
      return;
    }
    setSelectedFile(file);
    setError(null);
    const reader = new FileReader();
    reader.onloadend = () => setPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleUpload = async () => {
    const file = selectedFile;
    if (!file) {
      setError('Please select a file');
      return;
    }
    setUploading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append('photo', file);
      await api.post(`/pests/${pestId}/image`, formData, {
        transformRequest: [(data, headers) => {
          if (data instanceof FormData) {
            const h = headers as Record<string, unknown>;
            delete h['Content-Type'];
          }
          return data;
        }],
      });
      setPreview(null);
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      onImageChange();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to upload image');
    } finally {
      setUploading(false);
    }
  };

  const handleCancel = () => {
    setPreview(null);
    setSelectedFile(null);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleRemove = async () => {
    if (!confirm('Remove this image?')) return;
    setRemoving(true);
    setError(null);
    try {
      await api.patch(`/pests/${pestId}`, { image_url: null });
      onImageChange();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to remove image');
    } finally {
      setRemoving(false);
    }
  };

  return (
    <div className="pest-image-upload">
      <h4>Pest Image</h4>
      {imageUrl && !preview && (
        <div className="pest-image-current">
          <img src={imageUrl} alt="Current" />
          <div className="pest-image-actions">
            <button
              type="button"
              onClick={handleRemove}
              disabled={removing}
              className="btn-secondary btn-small"
            >
              {removing ? 'Removing...' : 'Remove image'}
            </button>
          </div>
        </div>
      )}
      {preview && (
        <div className="pest-image-preview">
          <img src={preview} alt="Preview" />
          <div className="pest-image-preview-actions">
            <button
              type="button"
              onClick={handleUpload}
              disabled={uploading}
              className="btn-primary btn-small"
            >
              {uploading ? 'Uploading...' : 'Upload'}
            </button>
            <button
              type="button"
              onClick={handleCancel}
              disabled={uploading}
              className="btn-secondary btn-small"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
      {!preview && (
        <div className="pest-image-upload-controls">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileSelect}
            className="pest-image-file-input"
            id={`pest-image-input-${pestId}`}
            disabled={uploading}
          />
          <label
            htmlFor={`pest-image-input-${pestId}`}
            className="btn-primary btn-small"
            style={{
              opacity: uploading ? 0.5 : 1,
              cursor: uploading ? 'not-allowed' : 'pointer',
            }}
          >
            {imageUrl ? 'Replace image' : 'Upload image'}
          </label>
        </div>
      )}
      {error && <div className="pest-image-error">{error}</div>}
    </div>
  );
}
