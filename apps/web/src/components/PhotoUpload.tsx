import { useState, useRef } from 'react';
import { api } from '../utils/api';
import AuthenticatedImage from './AuthenticatedImage';
import './PhotoUpload.css';

interface Photo {
  id: string;
  url: string;
  thumbnail_url: string;
  width?: number;
  height?: number;
  created_at: string;
}

interface PhotoUploadProps {
  entityType: 'apiaries' | 'hives' | 'queens' | 'inspections';
  entityId: string;
  photos: Photo[];
  onPhotoUploaded: () => void;
  maxPhotos?: number;
}

export default function PhotoUpload({
  entityType,
  entityId,
  photos,
  onPhotoUploaded,
  maxPhotos,
}: PhotoUploadProps) {
  const [uploading, setUploading] = useState(false);
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

    // Store the file in state to maintain reference even when input is hidden
    setSelectedFile(file);

    // Create preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setPreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleUpload = async () => {
    const file = selectedFile;
    if (!file) {
      setError('Please select a file');
      return;
    }

    if (maxPhotos && photos.length >= maxPhotos) {
      setError(`Maximum ${maxPhotos} photo(s) allowed`);
      return;
    }

    setUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('photo', file);

      let endpoint = '';
      switch (entityType) {
        case 'apiaries':
          endpoint = `/photos/apiaries/${entityId}`;
          break;
        case 'hives':
          endpoint = `/photos/hives/${entityId}`;
          break;
        case 'queens':
          endpoint = `/photos/queens/${entityId}`;
          break;
        case 'inspections':
          endpoint = `/photos/${entityId}`;
          break;
      }

      await api.post(endpoint, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      setPreview(null);
      setSelectedFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      onPhotoUploaded();
    } catch (err: any) {
      console.error('Photo upload failed:', err);
      setError(err.response?.data?.error || 'Failed to upload photo');
    } finally {
      setUploading(false);
    }
  };

  const handleCancel = () => {
    setPreview(null);
    setSelectedFile(null);
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="photo-upload">
      <div className="photo-upload-section">
        <h4>Photos</h4>
        {maxPhotos && (
          <p className="photo-limit">
            {photos.length} / {maxPhotos} photos
          </p>
        )}

        {preview && (
          <div className="photo-preview">
            <img src={preview} alt="Preview" />
            <div className="photo-preview-actions">
              <button
                onClick={handleUpload}
                disabled={uploading}
                className="btn-primary btn-small"
              >
                {uploading ? 'Uploading...' : 'Upload'}
              </button>
              <button
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
          <div className="photo-upload-controls">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileSelect}
              className="photo-file-input"
              id={`photo-input-${entityId}`}
              disabled={uploading || (maxPhotos ? photos.length >= maxPhotos : false)}
            />
            <label
              htmlFor={`photo-input-${entityId}`}
              className="btn-primary btn-small"
              style={{
                opacity: uploading || (maxPhotos ? photos.length >= maxPhotos : false) ? 0.5 : 1,
                cursor: uploading || (maxPhotos ? photos.length >= maxPhotos : false) ? 'not-allowed' : 'pointer',
              }}
            >
              <img src="/camera-icon.png" alt="" className="icon-inline" />
              Add Photo
            </label>
          </div>
        )}

        {error && <div className="error-message">{error}</div>}
      </div>

      {photos.length > 0 && (
        <div className="photo-gallery">
          {photos.map((photo) => (
            <div key={photo.id} className="photo-item">
              <div
                className="photo-link"
                onClick={async () => {
                  // Open full image in new window with authentication
                  try {
                    const baseUrl = import.meta.env.VITE_API_URL || '';
                    const fullUrl = baseUrl + photo.url;
                    const token = localStorage.getItem('token');
                    const response = await fetch(fullUrl, {
                      headers: {
                        'Authorization': `Bearer ${token}`,
                      },
                    });
                    if (response.ok) {
                      const blob = await response.blob();
                      const objectUrl = URL.createObjectURL(blob);
                      const newWindow = window.open();
                      if (newWindow) {
                        newWindow.location.href = objectUrl;
                      }
                    }
                  } catch (err) {
                    console.error('Failed to open full image:', err);
                  }
                }}
                style={{ cursor: 'pointer' }}
              >
                <AuthenticatedImage
                  src={photo.thumbnail_url}
                  alt="Photo"
                  className="photo-thumbnail"
                  loading="lazy"
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
