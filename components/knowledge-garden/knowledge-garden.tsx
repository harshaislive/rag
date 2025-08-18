"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { 
  Upload, 
  File, 
  FileText, 
  CheckCircle, 
  Clock, 
  Plus, 
  Search,
  MoreHorizontal,
  CloudUpload,
  Trash2,
  Database,
  Folder,
  X
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

interface Document {
  id: string;
  bucketId: string;
  name: string;
  fileType: string;
  fileSize: string;
  uploadDate: string;
  status: 'uploading' | 'processing' | 'completed' | 'error';
  progress?: number;
}

interface Bucket {
  id: string;
  name: string;
  description?: string;
  color: string;
  documentCount: number;
}

export default function KnowledgeGarden() {
  const [buckets, setBuckets] = useState<Bucket[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [activeBucket, setActiveBucket] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [newBucket, setNewBucket] = useState({
    name: '',
    description: '',
    color: '#344736'
  });
  const [isCreating, setIsCreating] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);

  // Fetch buckets from database
  const fetchBuckets = useCallback(async () => {
    try {
      const response = await fetch('/api/buckets');
      if (response.ok) {
        const data = await response.json();
        setBuckets(data.buckets);
        if (data.buckets.length > 0 && !activeBucket) {
          setActiveBucket(data.buckets[0].id);
        }
      }
    } catch (error) {
      console.error('Error fetching buckets:', error);
      toast.error('Failed to load knowledge buckets');
    }
  }, [activeBucket]);

  // Fetch documents for active bucket
  const fetchDocuments = async (bucketId: string) => {
    if (!bucketId) return;
    
    try {
      const response = await fetch(`/api/documents?bucketId=${bucketId}`);
      if (response.ok) {
        const data = await response.json();
        setDocuments(data.documents);
      }
    } catch (error) {
      console.error('Error fetching documents:', error);
      toast.error('Failed to load documents');
    }
  };

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await fetchBuckets();
      setLoading(false);
    };
    loadData();
  }, [fetchBuckets]);

  useEffect(() => {
    if (activeBucket) {
      fetchDocuments(activeBucket);
    }
  }, [activeBucket]);

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    
    if (e.dataTransfer.files) {
      handleFiles(e.dataTransfer.files);
    }
  };

  const handleFiles = async (files: FileList) => {
    if (!activeBucket) {
      toast.error('Please select a knowledge bucket first');
      return;
    }

    for (const file of Array.from(files)) {
      const newDoc: Document = {
        id: Date.now().toString() + Math.random(),
        bucketId: activeBucket,
        name: file.name,
        fileType: file.type.split('/')[1]?.toUpperCase() || 'UNKNOWN',
        fileSize: (file.size / (1024 * 1024)).toFixed(1) + ' MB',
        uploadDate: new Date().toISOString().split('T')[0],
        status: 'uploading',
        progress: 0
      };

      setDocuments(prev => [...prev, newDoc]);

      try {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('bucketId', activeBucket);

        // Simulate progress
        const progressInterval = setInterval(() => {
          setDocuments(prev => prev.map(doc => {
            if (doc.id === newDoc.id && doc.status === 'uploading') {
              const newProgress = Math.min((doc.progress || 0) + Math.random() * 10, 90);
              return { ...doc, progress: newProgress };
            }
            return doc;
          }));
        }, 500);

        const response = await fetch('/api/upload-working', {
          method: 'POST',
          body: formData,
        });

        clearInterval(progressInterval);

        if (response.ok) {
          toast.success(`${file.name} uploaded successfully`);
          
          // Update the local document to completed status first
          setDocuments(prev => prev.map(doc => 
            doc.id === newDoc.id 
              ? { ...doc, status: 'completed', progress: 100 }
              : doc
          ));
          
          // Wait a moment to show completion, then refresh from server
          setTimeout(async () => {
            await fetchBuckets();
            await fetchDocuments(activeBucket);
          }, 1000);
        } else {
          const error = await response.json();
          toast.error(error.error || `Failed to upload ${file.name}`);
          setDocuments(prev => prev.map(doc => 
            doc.id === newDoc.id 
              ? { ...doc, status: 'error', progress: undefined }
              : doc
          ));
        }
      } catch (error) {
        toast.error(`Upload failed: ${file.name}`);
        setDocuments(prev => prev.map(doc => 
          doc.id === newDoc.id 
            ? { ...doc, status: 'error', progress: undefined }
            : doc
        ));
      }
    }
  };

  const deleteDocument = async (documentId: string, fileName: string) => {
    console.log('Delete document called:', documentId, fileName);
    
    const confirmDelete = confirm(`Are you sure you want to delete "${fileName}"? This action cannot be undone.`);
    console.log('User confirmed deletion:', confirmDelete);
    
    if (!confirmDelete) {
      return;
    }

    try {
      console.log('Making DELETE request to:', `/api/documents/${documentId}`);
      const response = await fetch(`/api/documents/${documentId}`, {
        method: 'DELETE',
      });

      console.log('Delete response status:', response.status);

      if (response.ok) {
        const data = await response.json();
        console.log('Delete response data:', data);
        toast.success(`Successfully deleted ${fileName}`);
        
        // Remove document from local state immediately
        setDocuments(prev => prev.filter(doc => doc.id !== documentId));
        
        // Update bucket document count
        setBuckets(prev => prev.map(bucket => 
          bucket.id === activeBucket 
            ? { ...bucket, documentCount: Math.max(0, bucket.documentCount - 1) }
            : bucket
        ));
        
        // Refresh data from server after a short delay
        setTimeout(() => {
          fetchDocuments(activeBucket);
          fetchBuckets();
        }, 500);
      } else {
        const error = await response.json();
        console.error('Delete error response:', error);
        toast.error(`Failed to delete ${fileName}: ${error.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error deleting document:', error);
      toast.error(`Failed to delete ${fileName}`);
    }
  };

  const createBucket = async () => {
    if (!newBucket.name.trim()) {
      toast.error('Please enter a bucket name');
      return;
    }
    
    setIsCreating(true);
    try {
      console.log('Creating bucket:', newBucket);
      
      const response = await fetch('/api/buckets', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: newBucket.name,
          description: newBucket.description,
          color: newBucket.color,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        console.log('Bucket created successfully:', data);
        
        toast.success(`Created bucket: ${data.bucket.name}`);
        
        // Add the new bucket to local state
        setBuckets(prev => [...prev, data.bucket]);
        setActiveBucket(data.bucket.id);
        setNewBucket({ name: '', description: '', color: '#344736' });
        setIsDialogOpen(false);
        
        // Refresh buckets from server after a short delay
        setTimeout(() => {
          fetchBuckets();
        }, 500);
      } else {
        const error = await response.json();
        console.error('Bucket creation error:', error);
        toast.error(`Failed to create bucket: ${error.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error creating bucket:', error);
      toast.error('Failed to create bucket');
    } finally {
      setIsCreating(false);
    }
  };

  const deleteBucket = async (bucketId: string, bucketName: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent bucket selection when clicking delete
    console.log('Delete bucket called:', bucketId, bucketName);
    
    const confirmDelete = confirm(`Are you sure you want to delete bucket "${bucketName}"? This will permanently delete all documents in this bucket. This action cannot be undone.`);
    console.log('User confirmed bucket deletion:', confirmDelete);
    
    if (!confirmDelete) {
      return;
    }

    try {
      console.log('Making DELETE request to:', `/api/buckets/${bucketId}`);
      const response = await fetch(`/api/buckets/${bucketId}`, {
        method: 'DELETE',
      });

      console.log('Delete bucket response status:', response.status);

      if (response.ok) {
        const data = await response.json();
        console.log('Delete bucket response data:', data);
        toast.success(`Successfully deleted bucket "${bucketName}" and ${data.deletedResources} documents`);
        
        // Remove bucket from local state immediately
        setBuckets(prev => prev.filter(bucket => bucket.id !== bucketId));
        
        // Clear active bucket if it was the deleted one
        if (activeBucket === bucketId) {
          const remainingBuckets = buckets.filter(bucket => bucket.id !== bucketId);
          setActiveBucket(remainingBuckets.length > 0 ? remainingBuckets[0].id : '');
          setDocuments([]);
        }
        
        // Refresh data from server after a short delay
        setTimeout(() => {
          fetchBuckets();
        }, 500);
      } else {
        const error = await response.json();
        console.error('Delete bucket error response:', error);
        toast.error(`Failed to delete bucket: ${error.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error deleting bucket:', error);
      toast.error(`Failed to delete bucket "${bucketName}"`);
    }
  };

  const filteredDocuments = documents.filter(doc => 
    doc.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getStatusIcon = (status: Document['status']) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-emerald-600" />;
      case 'processing':
        return <Clock className="h-4 w-4 text-blue-600 animate-spin" />;
      case 'uploading':
        return <Upload className="h-4 w-4 text-blue-600" />;
      case 'error':
        return <X className="h-4 w-4 text-red-600" />;
      default:
        return <Clock className="h-4 w-4 text-muted-foreground" />;
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
        <div className="w-8 h-8 rounded-full border-2 border-border border-t-primary animate-spin" />
        <p className="text-muted-foreground text-sm">Loading Knowledge Garden...</p>
      </div>
    );
  }

  return (
    <div 
      className="h-full max-h-[700px] flex flex-col"
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {/* Drag Overlay */}
      <AnimatePresence>
        {isDragOver && (
          <motion.div 
            className="fixed inset-0 bg-primary/10 backdrop-blur-sm z-50 flex items-center justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <motion.div 
              className="bg-background border-2 border-dashed border-primary rounded-xl p-8 text-center shadow-lg"
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              transition={{ duration: 0.2 }}
            >
              <CloudUpload className="h-12 w-12 mx-auto mb-4 text-primary" />
              <p className="text-lg font-semibold">Drop files to upload</p>
              <p className="text-sm text-muted-foreground mt-2">
                {activeBucket ? `Files will be added to the selected bucket` : 'Please select a bucket first'}
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* Main Layout: Buckets | Documents */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-4 p-4 sm:p-6 overflow-hidden">
        {/* Left: Buckets */}
        <div className="lg:col-span-1 flex flex-col">
          <Card className="flex-1 border border-border rounded-xl overflow-hidden bg-background shadow-sm">
            <CardHeader className="pb-3 px-4 sm:px-6 border-b bg-muted/10">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm sm:text-base flex items-center gap-2">
                  <Folder className="h-3 w-3 sm:h-4 sm:w-4" />
                  Buckets
                </CardTitle>
                <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm" variant="outline" className="h-6 sm:h-7 text-xs">
                      <Plus className="h-3 w-3 mr-1" />
                      <span className="hidden sm:inline">New</span>
                      <span className="sm:hidden">+</span>
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                      <DialogTitle>Create Bucket</DialogTitle>
                      <DialogDescription>
                        Organize documents by topic
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="space-y-2">
                        <Label htmlFor="bucket-name">Name</Label>
                        <Input
                          id="bucket-name"
                          placeholder="e.g., HR Documents"
                          value={newBucket.name}
                          onChange={(e) => setNewBucket(prev => ({ ...prev, name: e.target.value }))}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="bucket-description">Description</Label>
                        <Textarea
                          id="bucket-description"
                          placeholder="Optional description"
                          value={newBucket.description}
                          onChange={(e) => setNewBucket(prev => ({ ...prev, description: e.target.value }))}
                          rows={2}
                        />
                      </div>
                      <div className="flex gap-2 pt-2">
                        <Button 
                          onClick={createBucket} 
                          disabled={isCreating || !newBucket.name.trim()}
                          className="flex-1"
                        >
                          {isCreating ? 'Creating...' : 'Create'}
                        </Button>
                        <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                          Cancel
                        </Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent className="pt-0 px-4 sm:px-6 flex-1 overflow-hidden">
              <ScrollArea className="h-full mobile-scroll mobile-hide-scrollbar">
                <div className="space-y-1">
                  {buckets.map((bucket, index) => (
                    <motion.div 
                      key={bucket.id}
                      className={cn(
                        "flex items-start gap-2 sm:gap-3 p-3 sm:p-4 rounded-lg cursor-pointer transition-all duration-200 group",
                        activeBucket === bucket.id 
                          ? "bg-primary/10 border border-primary/20 shadow-sm" 
                          : "hover:bg-muted/50 hover:border hover:border-primary/10"
                      )}
                      onClick={() => setActiveBucket(bucket.id)}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.1, duration: 0.3 }}
                    >
                      <div 
                        className="w-2 h-2 sm:w-3 sm:h-3 rounded-full flex-shrink-0 mt-1" 
                        style={{ backgroundColor: bucket.color }} 
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs sm:text-sm font-medium truncate">{bucket.name}</p>
                        {bucket.description && (
                          <p className="text-xs text-muted-foreground leading-relaxed mt-1" 
                             style={{
                               display: '-webkit-box',
                               WebkitLineClamp: 2,
                               WebkitBoxOrient: 'vertical',
                               overflow: 'hidden'
                             }}
                          >
                            {bucket.description}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="text-xs">
                          {bucket.documentCount}
                        </Badge>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="h-6 w-6 p-0 hover:bg-destructive hover:text-destructive-foreground opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={(e) => deleteBucket(bucket.id, bucket.name, e)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>

        {/* Right: Documents */}
        <div className="lg:col-span-2 flex flex-col">
          <Card className="flex-1 border border-border rounded-xl overflow-hidden bg-background shadow-sm">
            <CardHeader className="pb-3 px-4 sm:px-6 border-b bg-muted/10">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-0">
                <CardTitle className="text-sm sm:text-base flex items-center gap-2">
                  <FileText className="h-3 w-3 sm:h-4 sm:w-4" />
                  Documents ({filteredDocuments.length})
                </CardTitle>
                <div className="flex items-center gap-2">
                  {/* Upload Button */}
                  <Button 
                    size="sm"
                    onClick={() => document.getElementById('file-upload')?.click()}
                    disabled={!activeBucket}
                    className="h-7 sm:h-8 text-xs"
                  >
                    <CloudUpload className="h-3 w-3 mr-1" />
                    Upload
                  </Button>
                  
                  {/* Search */}
                  <div className="relative">
                    <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                    <Input
                      placeholder="Search..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-7 h-7 sm:h-8 w-32 sm:w-40 text-xs sm:text-sm"
                    />
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-0 px-4 sm:px-6 flex-1 overflow-hidden flex flex-col">
              {!activeBucket ? (
                <div className="flex flex-col items-center justify-center flex-1 text-muted-foreground text-center">
                  <Folder className="h-12 w-12 sm:h-16 sm:w-16 mx-auto mb-4 opacity-50" />
                  <p className="font-medium text-base sm:text-lg mb-2">Select a bucket</p>
                  <p className="text-sm sm:text-base">Choose a bucket to view documents</p>
                </div>
              ) : filteredDocuments.length === 0 ? (
                <div className="flex flex-col items-center justify-center flex-1 text-muted-foreground text-center">
                  <FileText className="h-12 w-12 sm:h-16 sm:w-16 mx-auto mb-4 opacity-50" />
                  <p className="font-medium text-base sm:text-lg mb-2">
                    {searchQuery ? 'No documents match your search' : 'No documents yet'}
                  </p>
                  <p className="text-sm sm:text-base">
                    {searchQuery ? 'Try a different search term' : 'Click Upload to add files'}
                  </p>
                </div>
              ) : (
                <ScrollArea className="h-full mobile-scroll mobile-hide-scrollbar">
                  <div className="space-y-2">
                    {filteredDocuments.map((doc, index) => (
                      <motion.div
                        key={doc.id}
                        className="flex items-center gap-2 sm:gap-3 p-3 rounded-lg border hover:bg-muted/30 transition-all duration-200 hover:border-primary/30 hover:shadow-sm group"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.05, duration: 0.3 }}
                      >
                        <File className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-xs sm:text-sm truncate">{doc.name}</p>
                          <div className="flex items-center gap-2 sm:gap-3 text-xs text-muted-foreground">
                            <span>{doc.fileType}</span>
                            <span>{doc.fileSize}</span>
                            <span>{doc.uploadDate}</span>
                          </div>
                          {doc.status === 'uploading' && doc.progress !== undefined && (
                            <Progress value={doc.progress} className="w-32 h-1 mt-1" />
                          )}
                        </div>
                        
                        <div className="flex items-center gap-2">
                          <Badge 
                            variant={doc.status === 'completed' ? 'default' : 
                                   doc.status === 'error' ? 'destructive' : 'secondary'} 
                            className="text-xs flex items-center gap-1"
                          >
                            {getStatusIcon(doc.status)}
                            {doc.status}
                          </Badge>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="h-6 w-6 p-0 hover:bg-destructive hover:text-destructive-foreground opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={() => deleteDocument(doc.id, doc.name)}
                            disabled={doc.status === 'uploading'}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Hidden File Input */}
      <Input
        type="file"
        multiple
        accept=".txt,.pdf,.doc,.docx,.csv,.json,.xls,.xlsx,.html,.xml"
        className="hidden"
        onChange={(e) => {
          if (e.target.files) {
            handleFiles(e.target.files);
          }
        }}
        id="file-upload"
      />
    </div>
  );
}