import { useState, useEffect } from 'react';

/**
 * Dynamic Storage Input Component
 * Allows adding/removing multiple storage entries
 * Each entry: { jenis_storage, kapasitas }
 */
export default function StorageInput({ value = [], onChange }) {
  const [storages, setStorages] = useState([]);

  // Initialize from value prop
  useEffect(() => {
    if (value && value.length > 0) {
      setStorages(value);
    } else {
      setStorages([]);
    }
  }, [value]);

  // Update parent component
  const updateParent = (newStorages) => {
    setStorages(newStorages);
    onChange(newStorages);
  };

  // Add new storage entry
  const handleAdd = () => {
    const newStorages = [
      ...storages,
      { jenis_storage: 'SSD', kapasitas: '' }
    ];
    updateParent(newStorages);
  };

  // Remove storage entry
  const handleRemove = (index) => {
    const newStorages = storages.filter((_, i) => i !== index);
    updateParent(newStorages);
  };

  // Update storage entry
  const handleUpdate = (index, field, value) => {
    const newStorages = [...storages];
    
    // For kapasitas, only allow numbers
    if (field === 'kapasitas') {
      // Allow only digits
      if (value && !/^\d+$/.test(value)) {
        return;
      }
    }
    
    newStorages[index][field] = value;
    updateParent(newStorages);
  };

  return (
    <div className="space-y-3">
      {/* Storage entries */}
      {storages.map((storage, index) => (
        <div key={index} className="space-y-2 sm:space-y-0">
          {/* Row 1: Index, Storage Type, Remove Button */}
          <div className="flex items-center gap-2">
            {/* Index number */}
            <div className="w-6 h-8 flex items-center justify-center bg-gray-900 border border-gray-800 rounded text-xs font-semibold text-gray-400">
              {index + 1}
            </div>

            {/* Jenis Storage dropdown */}
            <select
              value={storage.jenis_storage}
              onChange={(e) => handleUpdate(index, 'jenis_storage', e.target.value)}
              className="w-20 sm:w-28 px-2 sm:px-3 py-1.5 text-xs bg-gray-950 border border-gray-800 text-white rounded-lg focus:ring-2 focus:ring-gray-600 focus:border-transparent"
            >
              <option value="SSD">SSD</option>
              <option value="HDD">HDD</option>
              <option value="NVMe">NVMe</option>
            </select>

            {/* Desktop: Kapasitas input inline */}
            <div className="hidden sm:flex sm:w-24 sm:relative sm:items-center">
              <input
                type="text"
                value={storage.kapasitas}
                onChange={(e) => handleUpdate(index, 'kapasitas', e.target.value)}
                placeholder="256"
                className="w-full px-3 py-1.5 text-xs bg-gray-950 border border-gray-800 text-white rounded-lg focus:ring-2 focus:ring-gray-600 focus:border-transparent placeholder-gray-500 pr-10"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 text-xs font-medium">
                GB
              </span>
            </div>

            {/* Remove button */}
            <button
              type="button"
              onClick={() => handleRemove(index)}
              className="ml-auto sm:ml-0 w-7 h-7 flex items-center justify-center bg-red-950/50 text-red-400 border border-red-900/50 rounded-lg hover:bg-red-900/50 transition text-sm font-medium"
              title="Hapus storage"
            >
              ×
            </button>
          </div>

          {/* Row 2: Kapasitas input (mobile only) */}
          <div className="flex items-center gap-2 sm:hidden">
            <div className="w-6"></div>
            <div className="w-24 relative">
              <input
                type="text"
                value={storage.kapasitas}
                onChange={(e) => handleUpdate(index, 'kapasitas', e.target.value)}
                placeholder="256"
                className="w-full px-3 py-1.5 text-xs bg-gray-950 border border-gray-800 text-white rounded-lg focus:ring-2 focus:ring-gray-600 focus:border-transparent placeholder-gray-500 pr-10"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 text-xs font-medium">
                GB
              </span>
            </div>
          </div>
        </div>
      ))}

      {/* Add button */}
      <button
        type="button"
        onClick={handleAdd}
        className="w-full px-4 py-1.5 bg-gray-900 text-gray-300 border border-gray-800 rounded-lg hover:bg-gray-800 transition text-xs font-medium flex items-center justify-center gap-2"
      >
        <span className="text-sm">+</span>
        <span>Tambah Storage</span>
      </button>

      {/* Info text */}
      {storages.length === 0 && (
        <p className="text-xs text-gray-600 italic">
          Belum ada storage. Klik "Tambah Storage" untuk menambahkan.
        </p>
      )}
    </div>
  );
}
