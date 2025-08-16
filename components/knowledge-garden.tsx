"use client";

import { useState, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Upload, FileText, File, X, CheckCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface UploadedFile {
  id: string;
  name: string;
  size: number;
  type: string;
  status: 'uploading' | 'processing' | 'completed' | 'error';
  progress: number;
}

export default function KnowledgeGarden() {
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    
    const droppedFiles = Array.from(e.dataTransfer.files);
    processFiles(droppedFiles);
  }, []);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const selectedFiles = Array.from(e.target.files);
      processFiles(selectedFiles);
    }
  }, []);

  const processFiles = (fileList: File[]) => {
    const supportedTypes = ['.pdf', '.doc', '.docx', '.txt'];
    
    fileList.forEach((file) => {
      const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase();
      
      if (supportedTypes.includes(fileExtension)) {
        const newFile: UploadedFile = {
          id: Math.random().toString(36).substring(7),
          name: file.name,
          size: file.size,
          type: fileExtension,
          status: 'uploading',
          progress: 0
        };
        
        setFiles(prev => [...prev, newFile]);
        
        // Simulate upload and processing
        simulateFileProcessing(newFile.id);
      }
    });
  };

  const simulateFileProcessing = (fileId: string) => {
    // Simulate upload progress
    const uploadInterval = setInterval(() => {
      setFiles(prev => prev.map(file => {
        if (file.id === fileId && file.status === 'uploading') {
          const newProgress = Math.min(file.progress + 20, 100);
          if (newProgress === 100) {
            clearInterval(uploadInterval);
            setTimeout(() => {
              setFiles(prev => prev.map(f => 
                f.id === fileId ? { ...f, status: 'processing', progress: 0 } : f
              ));
              simulateProcessing(fileId);
            }, 500);
            return { ...file, progress: newProgress };
          }
          return { ...file, progress: newProgress };
        }
        return file;
      }));
    }, 300);
  };

  const simulateProcessing = (fileId: string) => {
    const processingInterval = setInterval(() => {
      setFiles(prev => prev.map(file => {
        if (file.id === fileId && file.status === 'processing') {
          const newProgress = Math.min(file.progress + 15, 100);
          if (newProgress === 100) {
            clearInterval(processingInterval);
            setTimeout(() => {
              setFiles(prev => prev.map(f => 
                f.id === fileId ? { ...f, status: 'completed' } : f
              ));
            }, 500);
            return { ...file, progress: newProgress };
          }
          return { ...file, progress: newProgress };
        }
        return file;
      }));
    }, 400);
  };

  const removeFile = (fileId: string) => {
    setFiles(prev => prev.filter(file => file.id !== fileId));
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getFileIcon = (type: string) => {
    switch (type) {
      case '.pdf':
        return <FileText className="h-4 w-4 text-beforest-rich-red" />;
      case '.doc':
      case '.docx':
        return <File className="h-4 w-4 text-beforest-deep-blue" />;
      case '.txt':
        return <FileText className="h-4 w-4 text-beforest-forest-green" />;
      default:
        return <File className="h-4 w-4 text-beforest-charcoal" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'uploading':
        return <Badge variant="secondary" className="bg-beforest-warm-yellow text-beforest-dark-earth">Uploading</Badge>;
      case 'processing':
        return <Badge variant="secondary" className="bg-beforest-light-blue text-beforest-deep-blue">Processing</Badge>;
      case 'completed':
        return <Badge variant="secondary" className="bg-beforest-soft-green text-beforest-forest-green">Completed</Badge>;
      case 'error':
        return <Badge variant="destructive">Error</Badge>;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      {/* Upload Area */}
      <Card className="border-2 border-dashed border-beforest-soft-gray hover:border-beforest-forest-green transition-colors">
        <CardContent className="p-8">
          <div
            className={cn(
              "flex flex-col items-center justify-center space-y-4 text-center",
              isDragOver && "bg-beforest-soft-gray/30 rounded-lg p-4"
            )}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <Upload className="h-12 w-12 text-beforest-charcoal" />
            <div className="space-y-2">
              <h3 className="text-lg font-semibold text-beforest-dark-earth">
                Upload Documents
              </h3>
              <p className="text-sm text-beforest-charcoal">
                Drag and drop files here, or click to browse
              </p>
              <p className="text-xs text-beforest-charcoal">
                Supports PDF, DOC, DOCX, and TXT files
              </p>
            </div>
            <input
              type="file"
              multiple
              accept=".pdf,.doc,.docx,.txt"
              onChange={handleFileSelect}
              className="hidden"
              id="file-upload"
            />
            <label htmlFor="file-upload">
              <Button 
                variant="outline" 
                className="border-beforest-forest-green text-beforest-forest-green hover:bg-beforest-forest-green hover:text-white"
                type="button"
              >
                Choose Files
              </Button>
            </label>
          </div>
        </CardContent>
      </Card>

      {/* File List */}
      {files.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-beforest-dark-earth">Uploaded Documents</CardTitle>
            <CardDescription>
              {files.filter(f => f.status === 'completed').length} of {files.length} documents processed
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {files.map((file) => (
              <div key={file.id} className="flex items-center space-x-4 p-4 border border-beforest-soft-gray rounded-lg">
                <div className="flex-shrink-0">
                  {getFileIcon(file.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center space-x-2">
                    <p className="text-sm font-medium text-beforest-dark-earth truncate">
                      {file.name}
                    </p>
                    {getStatusBadge(file.status)}
                  </div>
                  <p className="text-xs text-beforest-charcoal">
                    {formatFileSize(file.size)}
                  </p>
                  {(file.status === 'uploading' || file.status === 'processing') && (
                    <Progress 
                      value={file.progress} 
                      className="mt-2 h-2"
                    />
                  )}
                </div>
                <div className="flex-shrink-0">
                  {file.status === 'completed' ? (
                    <CheckCircle className="h-5 w-5 text-beforest-soft-green" />
                  ) : (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeFile(file.id)}
                      className="h-8 w-8 p-0 hover:bg-beforest-soft-gray"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="text-center">
              <p className="text-2xl font-bold text-beforest-deep-blue">
                {files.filter(f => f.status === 'completed').length}
              </p>
              <p className="text-sm text-beforest-charcoal">Documents Processed</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="text-center">
              <p className="text-2xl font-bold text-beforest-forest-green">
                {files.filter(f => f.status === 'processing' || f.status === 'uploading').length}
              </p>
              <p className="text-sm text-beforest-charcoal">In Progress</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="text-center">
              <p className="text-2xl font-bold text-beforest-rich-red">
                {files.reduce((acc, file) => acc + file.size, 0) > 0 
                  ? formatFileSize(files.reduce((acc, file) => acc + file.size, 0))
                  : '0 Bytes'
                }
              </p>
              <p className="text-sm text-beforest-charcoal">Total Size</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}