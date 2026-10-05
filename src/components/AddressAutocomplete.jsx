import React, { useState, useEffect, useRef } from 'react';

export default function AddressAutocomplete({ value, onChange, placeholder, inputClassName }) {
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [locations, setLocations] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const wrapperRef = useRef(null);

  useEffect(() => {
    // Fetch Vietnam provinces and districts from open API (depth=2)
    fetch('https://provinces.open-api.vn/api/?depth=2')
      .then(res => res.json())
      .then(data => {
        let allLocations = [];
        data.forEach(province => {
          // Add province itself
          allLocations.push(province.name);
          // Add districts formatted as "District, Province"
          if (province.districts) {
            province.districts.forEach(district => {
              allLocations.push(`${district.name}, ${province.name}`);
            });
          }
        });
        setLocations(allLocations);
        setIsLoading(false);
      })
      .catch(err => {
        console.error("Error fetching locations:", err);
        setIsLoading(false);
      });

    // Handle click outside to close dropdown
    function handleClickOutside(event) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleChange = (e) => {
    const val = e.target.value;
    onChange(val);
    
    if (val.trim().length > 0) {
      const lowerVal = val.toLowerCase();
      // Lọc ra các địa điểm chứa từ khóa, ưu tiên hiển thị tối đa 15 kết quả
      const filtered = locations.filter(loc => 
        loc.toLowerCase().includes(lowerVal)
      ).slice(0, 15);
      setSuggestions(filtered);
      setShowSuggestions(true);
    } else {
      setShowSuggestions(false);
    }
  };

  const handleSelect = (suggestion) => {
    onChange(suggestion);
    setShowSuggestions(false);
  };

  return (
    <div className="relative w-full" ref={wrapperRef}>
      <input
        type="text"
        value={value}
        onChange={handleChange}
        onFocus={() => { if(value) handleChange({target: {value}}) }}
        placeholder={placeholder || "Tìm kiếm địa chỉ..."}
        className={inputClassName}
      />
      
      {showSuggestions && suggestions.length > 0 && (
        <ul className="absolute z-50 w-full bg-white border border-chalk mt-1 rounded-lg shadow-xl max-h-60 overflow-y-auto">
          {suggestions.map((suggestion, index) => (
            <li 
              key={index}
              onClick={() => handleSelect(suggestion)}
              className="px-4 py-2 hover:bg-fog cursor-pointer text-sm text-carbon transition-colors"
            >
              {suggestion}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
