"use client";

import { useState, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Upload, FileText, File, X, CheckCircle, Clock, Brain, Scissors, Search, AlertCircle, RefreshCw, Lightbulb } from "lucide-react";
import { cn } from "@/lib/utils";

interface UploadedFile {
  id: string;
  name: string;
  size: number;
  type: string;
  status: 'uploading' | 'extracting' | 'chunking' | 'embedding' | 'completed' | 'error';
  progress: number;
  currentStep: string;
  wordCount?: number;
  chunkCount?: number;
  timeStarted?: Date;
  errorMessage?: string;
  suggestions?: string[];
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

  const simulateProcessing = useCallback((fileId: string) => {
    // Step 1: Extracting
    setTimeout(() => {
      setFiles(prev => prev.map(f => 
        f.id === fileId ? { 
          ...f, 
          status: 'extracting', 
          progress: 25, 
          currentStep: 'Reading document content...',
          wordCount: Math.floor(Math.random() * 3000) + 500
        } : f
      ));
    }, 800);

    // Step 2: Chunking
    setTimeout(() => {
      setFiles(prev => prev.map(f => 
        f.id === fileId ? { 
          ...f, 
          status: 'chunking', 
          progress: 50, 
          currentStep: 'Breaking into searchable chunks...',
          chunkCount: Math.floor((f.wordCount || 1000) / 200)
        } : f
      ));
    }, 2000);

    // Step 3: Embedding
    setTimeout(() => {
      setFiles(prev => prev.map(f => 
        f.id === fileId ? { 
          ...f, 
          status: 'embedding', 
          progress: 85, 
          currentStep: `Generating AI embeddings for ${f.chunkCount || 5} chunks...`
        } : f
      ));
    }, 3500);

    // Step 4: Completed
    setTimeout(() => {
      setFiles(prev => prev.map(f => 
        f.id === fileId ? { 
          ...f, 
          status: 'completed', 
          progress: 100, 
          currentStep: 'Ready for search!'
        } : f
      ));
    }, 5500);
  }, []);

  const simulateFileProcessing = useCallback((fileId: string) => {
    // Simulate upload progress
    const uploadInterval = setInterval(() => {
      setFiles(prev => prev.map(file => {
        if (file.id === fileId && file.status === 'uploading') {
          const newProgress = Math.min(file.progress + 25, 100);
          if (newProgress === 100) {
            clearInterval(uploadInterval);
            simulateProcessing(fileId);
            return { ...file, progress: newProgress, currentStep: 'Upload complete!' };
          }
          return { ...file, progress: newProgress, currentStep: 'Uploading file...' };
        }
        return file;
      }));
    }, 200);
  }, [simulateProcessing]);

  const processFiles = useCallback((fileList: File[]) => {
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
          progress: 0,
          currentStep: 'Starting upload...',
          timeStarted: new Date()
        };
        
        setFiles(prev => [...prev, newFile]);
        
        // Simulate upload and processing
        simulateFileProcessing(newFile.id);
      }
    });
  }, [simulateFileProcessing]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    
    const droppedFiles = Array.from(e.dataTransfer.files);
    processFiles(droppedFiles);
  }, [processFiles]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const selectedFiles = Array.from(e.target.files);
      processFiles(selectedFiles);
    }
  }, [processFiles]);

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

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'uploading':
        return <Upload className="h-4 w-4 text-beforest-warm-yellow animate-pulse" />;
      case 'extracting':
        return <Search className="h-4 w-4 text-beforest-light-blue animate-spin" />;
      case 'chunking':
        return <Scissors className="h-4 w-4 text-beforest-coral-orange animate-bounce" />;
      case 'embedding':
        return <Brain className="h-4 w-4 text-beforest-deep-blue animate-pulse" />;
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-beforest-soft-green" />;
      case 'error':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      default:
        return <Clock className="h-4 w-4 text-beforest-charcoal" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'uploading':
        return <Badge className="bg-beforest-warm-yellow/20 text-beforest-dark-earth border-beforest-warm-yellow">📤 Uploading</Badge>;
      case 'extracting':
        return <Badge className="bg-beforest-light-blue/20 text-beforest-deep-blue border-beforest-light-blue">🔍 Extracting Text</Badge>;
      case 'chunking':
        return <Badge className="bg-beforest-coral-orange/20 text-beforest-dark-earth border-beforest-coral-orange">✂️ Creating Chunks</Badge>;
      case 'embedding':
        return <Badge className="bg-beforest-deep-blue/20 text-beforest-deep-blue border-beforest-deep-blue">🧠 AI Processing</Badge>;
      case 'completed':
        return <Badge className="bg-beforest-soft-green/20 text-beforest-forest-green border-beforest-soft-green">✅ Ready to Search</Badge>;
      case 'error':
        return <Badge variant="destructive">❌ Error</Badge>;
      default:
        return null;
    }
  };

  const getStatusMessage = (file: UploadedFile) => {
    const elapsed = file.timeStarted ? Math.floor((Date.now() - file.timeStarted.getTime()) / 1000) : 0;
    
    switch (file.status) {
      case 'completed':
        return (
          <div className="space-y-1 text-xs text-beforest-forest-green">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-3 w-3" />
              <span className="font-medium">Ready for search!</span>
            </div>
            <div className="text-beforest-charcoal">
              {file.wordCount?.toLocaleString()} words • {file.chunkCount} chunks • Processed in {elapsed}s
            </div>
            <div className="flex items-center gap-1 text-beforest-deep-blue">
              <Lightbulb className="h-3 w-3" />
              <span>Try asking about this document in chat</span>
            </div>
          </div>
        );
      case 'error':
        return (
          <div className="space-y-2 text-xs">
            <div className="text-red-600">{file.errorMessage || 'Processing failed'}</div>
            {file.suggestions && (
              <div className="space-y-1">
                {file.suggestions.map((suggestion, idx) => (
                  <div key={idx} className="flex items-center gap-1 text-beforest-charcoal">
                    <Lightbulb className="h-3 w-3" />
                    <span>{suggestion}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      default:
        return (
          <div className="text-xs text-beforest-charcoal">
            {file.currentStep} {elapsed > 0 && `• ${elapsed}s elapsed`}
          </div>
        );
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
              <div key={file.id} className={cn(
                "p-4 border rounded-lg transition-all duration-300",
                file.status === 'completed' && "border-beforest-soft-green bg-beforest-soft-green/5",
                file.status === 'error' && "border-red-200 bg-red-50",
                (file.status === 'uploading' || file.status === 'extracting' || file.status === 'chunking' || file.status === 'embedding') && "border-beforest-light-blue bg-beforest-light-blue/5",
                file.status === 'uploading' && "animate-pulse"
              )}>
                <div className="flex items-start space-x-4">
                  <div className="flex-shrink-0 pt-1">
                    {getFileIcon(file.type)}
                  </div>
                  <div className="flex-1 min-w-0 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <p className="text-sm font-medium text-beforest-dark-earth truncate">
                          {file.name}
                        </p>
                        {getStatusBadge(file.status)}
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className="text-xs text-beforest-charcoal">
                          {formatFileSize(file.size)}
                        </span>
                        {getStatusIcon(file.status)}
                      </div>
                    </div>
                  {file.status !== 'completed' && file.status !== 'error' && (
                    <div className="space-y-1 mt-2">
                      <Progress 
                        value={file.progress} 
                        className="h-2 bg-beforest-soft-gray"
                      />
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-beforest-charcoal">
                          {file.progress}%
                        </span>
                        <span className="text-xs text-beforest-charcoal">
                          Step {file.status === 'uploading' ? '1' : file.status === 'extracting' ? '2' : file.status === 'chunking' ? '3' : '4'} of 4
                        </span>
                      </div>
                    </div>
                  )}
                  <div className="mt-2">
                    {getStatusMessage(file)}
                  </div>
                </div>
                  <div className="flex-shrink-0">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeFile(file.id)}
                      className="text-beforest-charcoal hover:text-beforest-rich-red hover:bg-beforest-rich-red/10"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
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
                {files.filter(f => f.status !== 'completed' && f.status !== 'error').length}
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