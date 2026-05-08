import React, { useState } from 'react';
import { Plus, X, Star, Upload } from 'lucide-react';

export interface ProductImage {
    id: string;
    url: string;
    isPrimary: boolean;
}

interface ImageUploadProps {
    images: ProductImage[];
    onChange: (images: ProductImage[]) => void;
}

export const ImageUpload: React.FC<ImageUploadProps> = ({ images, onChange }) => {
    const [dragging, setDragging] = useState(false);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            processFiles(e.target.files);
        }
    };

    const processFiles = (files: FileList) => {
        const newImages: ProductImage[] = [];
        Array.from(files).forEach((file, index) => {
            if (images.length + newImages.length >= 10) return;

            const reader = new FileReader();
            reader.onload = (e) => {
                const url = e.target?.result as string;
                const newImg = {
                    id: `img-${Date.now()}-${index}`,
                    url,
                    isPrimary: images.length === 0 && newImages.length === 0
                };
                newImages.push(newImg);
                if (newImages.length === Math.min(files.length, 10 - images.length)) {
                    onChange([...images, ...newImages]);
                }
            };
            reader.readAsDataURL(file);
        });
    };

    const removeImage = (id: string) => {
        const filtered = images.filter(img => img.id !== id);
        if (filtered.length > 0 && !filtered.find(img => img.isPrimary)) {
            filtered[0].isPrimary = true;
        }
        onChange(filtered);
    };

    const setPrimary = (id: string) => {
        onChange(images.map(img => ({ ...img, isPrimary: img.id === id })));
    };

    return (
        <div className="space-y-6">
            <div
                onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={(e) => {
                    e.preventDefault();
                    setDragging(false);
                    processFiles(e.dataTransfer.files);
                }}
                className={`
                    relative group border-4 border-dashed rounded-[32px] p-10 transition-all duration-300 flex flex-col items-center justify-center text-center cursor-pointer
                    ${dragging ? 'border-gray-900 bg-gray-50 scale-[1.02]' : 'border-gray-100 bg-white hover:border-gray-200'}
                `}
                onClick={() => document.getElementById('image-upload-input')?.click()}
            >
                <input
                    id="image-upload-input"
                    type="file"
                    multiple
                    accept="image/*"
                    className="hidden"
                    onChange={handleFileChange}
                />
                <div className={`
                    w-20 h-20 rounded-3xl shadow-2xl flex items-center justify-center mb-6 transition-all duration-500
                    ${dragging ? 'bg-gray-900 text-white rotate-12' : 'bg-white text-gray-300 group-hover:text-gray-900 group-hover:scale-110'}
                `}>
                    <Upload size={32} />
                </div>
                <div>
                    <h4 className="text-[12px] font-black uppercase tracking-widest text-gray-900">Click to upload</h4>
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-2">or drag and drop</p>
                    <p className="text-[9px] font-bold text-gray-300 uppercase tracking-widest mt-4">JPG, PNG or WEBP (MAX 5MB per image)</p>
                </div>
            </div>

            {images.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
                    {images.map((img) => (
                        <div key={img.id} className="relative group aspect-square rounded-2xl overflow-hidden border border-gray-100 shadow-sm bg-gray-50">
                            <img src={img.url} alt="Product" className="w-full h-full object-cover" />
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                {!img.isPrimary && (
                                    <button
                                        onClick={() => setPrimary(img.id)}
                                        className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-gray-400 hover:text-amber-500 transition-all"
                                        title="Set as Primary"
                                    >
                                        <Star size={18} />
                                    </button>
                                )}
                                <button
                                    onClick={() => removeImage(img.id)}
                                    className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-gray-400 hover:text-red-500 transition-all"
                                    title="Remove"
                                >
                                    <X size={18} />
                                </button>
                            </div>
                            {img.isPrimary && (
                                <div className="absolute top-3 left-3 px-3 py-1 bg-amber-500 text-white text-[9px] font-black uppercase tracking-widest rounded-full flex items-center gap-1.5 shadow-lg">
                                    <Star size={10} fill="currentColor" /> Primary
                                </div>
                            )}
                        </div>
                    ))}
                    {images.length < 10 && (
                        <button
                            onClick={() => document.getElementById('image-upload-input')?.click()}
                            className="aspect-square border-2 border-dashed border-gray-200 rounded-2xl flex flex-col items-center justify-center text-gray-300 hover:text-gray-900 hover:border-gray-900 transition-all group"
                        >
                            <Plus size={24} className="group-hover:scale-110 transition-transform" />
                            <span className="text-[9px] font-black uppercase tracking-widest mt-2">Add More</span>
                        </button>
                    )}
                </div>
            )}
        </div>
    );
};
