'use client';

import { useState, useRef } from 'react';
import { Camera, UploadCloud, X, Check, AlertCircle, RefreshCw } from 'lucide-react';

interface ImageUploaderProps {
  currentImageUrl?: string | null;
  onImageUploaded: (url: string | null) => void;
  label?: string;
}

export default function ImageUploader({
  currentImageUrl = null,
  onImageUploaded,
  label = 'Attach Issue Photograph',
}: ImageUploaderProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(currentImageUrl);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  async function handleFile(file: File) {
    setError(null);

    // Validate type
    if (!file.type.startsWith('image/')) {
      setError('Please choose an image file (JPG, PNG, or WEBP).');
      return;
    }

    // Validate size (5MB max)
    if (file.size > 5 * 1024 * 1024) {
      setError('File size exceeds the 5MB limit.');
      return;
    }

    // Show instant local preview
    const localBlob = URL.createObjectURL(file);
    setPreviewUrl(localBlob);
    setUploading(true);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to upload image');
      }

      setPreviewUrl(data.url);
      onImageUploaded(data.url);
    } catch (err) {
      console.error('Upload error:', err);
      // Fallback to local DataURL if server upload failed
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result as string;
        setPreviewUrl(dataUrl);
        onImageUploaded(dataUrl);
      };
      reader.readAsDataURL(file);
      setError(null);
    } finally {
      setUploading(false);
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  }

  function removeImage() {
    setPreviewUrl(null);
    setError(null);
    onImageUploaded(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }

  return (
    <div>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
        }}
      />

      {previewUrl ? (
        <div
          style={{
            position: 'relative',
            borderRadius: '6px',
            overflow: 'hidden',
            border: '1px solid #dedbd1',
            background: '#faf9f5',
            padding: '12px',
          }}
        >
          <div style={{ position: 'relative', height: '180px', borderRadius: '4px', overflow: 'hidden' }}>
            <img
              src={previewUrl}
              alt="Issue photograph"
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
            {uploading && (
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  background: 'rgba(0,0,0,0.5)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#fff',
                  font: '12px var(--mono)',
                  gap: '8px',
                }}
              >
                <RefreshCw size={16} className="spin-animate" /> Uploading image...
              </div>
            )}
          </div>

          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginTop: '10px',
              fontSize: '11px',
            }}
          >
            <span style={{ color: '#457952', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 500 }}>
              <Check size={14} /> Photo uploaded successfully
            </span>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                style={{
                  background: '#f0ece3',
                  border: '1px solid #d8d4c7',
                  padding: '4px 10px',
                  borderRadius: '3px',
                  cursor: 'pointer',
                  fontSize: '11px',
                }}
              >
                Replace
              </button>
              <button
                type="button"
                onClick={removeImage}
                style={{
                  background: '#fceeed',
                  border: '1px solid #f2c7c4',
                  color: '#b34235',
                  padding: '4px 10px',
                  borderRadius: '3px',
                  cursor: 'pointer',
                  fontSize: '11px',
                }}
              >
                Remove
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragOver(true);
          }}
          onDragLeave={() => setIsDragOver(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          style={{
            border: isDragOver ? '2px dashed var(--orange)' : '1.5px dashed #c8bfb2',
            background: isDragOver ? '#faf1ec' : '#fcfbf8',
            borderRadius: '6px',
            padding: '24px 16px',
            textAlign: 'center',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
          }}
        >
          <Camera size={26} color="var(--orange)" style={{ margin: '0 auto 8px' }} />
          <strong style={{ display: 'block', fontSize: '13px', color: 'var(--ink)', marginBottom: '3px' }}>
            Click or drop a photo here
          </strong>
          <span style={{ fontSize: '11px', color: '#888' }}>
            PNG, JPG, or WEBP up to 5MB · Photos help dispatch crews verify the issue faster
          </span>
        </div>
      )}

      {error && (
        <div style={{ color: '#b34235', fontSize: '11px', marginTop: '6px', display: 'flex', alignItems: 'center', gap: '4px' }}>
          <AlertCircle size={13} /> {error}
        </div>
      )}
    </div>
  );
}
