import { useEffect, useState } from 'react'
import type { Dispatch, SetStateAction } from 'react'

interface Props {
  pastTags: string[]
  currentTags: string[]
  onChange: Dispatch<SetStateAction<string[]>>
  inputValue: string
  onInputChange: Dispatch<SetStateAction<string>>
}

export default function TagSuggestions({
  pastTags,
  currentTags,
  onChange,
  inputValue,
  onInputChange
}: Props) {
  const availableTags = pastTags.filter(tag => !currentTags.includes(tag))

  const addTag = (tag: string) => {
    const normalized = tag.trim().toLowerCase()
    if (normalized && !currentTags.includes(normalized)) {
      onChange(prev => [...prev, normalized])
    }
    onInputChange('')
  }

  const removeTag = (tagToRemove: string) => {
    onChange(prev => prev.filter(t => t !== tagToRemove))
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      addTag(inputValue)
    }
  }

  const topTags = availableTags.slice(0, 12)

  return (
    <div className="form-label">
      <label>Tags</label>
      
      {/* Current tags */}
      {currentTags.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
          {currentTags.map(tag => (
            <span
              key={tag}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                padding: '4px 8px',
                background: 'var(--accent-bg)',
                border: '1px solid var(--accent)',
                borderRadius: 6,
                fontSize: 12,
                fontWeight: 500,
              }}
            >
              {tag}
              <button
                type="button"
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--accent)',
                  fontSize: 14,
                  lineHeight: 1,
                  padding: 0,
                  width: 16,
                  height: 16,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                onClick={() => removeTag(tag)}
              >
                ✕
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Suggestions + Input row */}
      <div style={{ display: 'flex', gap: 6, alignItems: 'end' }}>
        {/* Suggestion chips */}
        {topTags.length > 0 && (
          <div 
            style={{ 
              display: 'flex', 
              flexWrap: 'wrap', 
              gap: 4, 
              maxWidth: '60%', 
              flex: 1,
              padding: '4px 8px',
              background: 'var(--bg)',
              border: '1px solid var(--border)',
              borderRadius: 6,
            }}
            title="Click to add tag"
          >
            {topTags.map(tag => (
              <button
                key={tag}
                type="button"
                style={{
                  padding: '2px 6px',
                  background: currentTags.includes(tag) ? 'var(--accent-bg)' : 'transparent',
                  border: `1px solid ${currentTags.includes(tag) ? 'var(--accent)' : 'var(--border)'}`,
                  borderRadius: 4,
                  fontSize: 11,
                  cursor: 'pointer',
                  opacity: currentTags.includes(tag) ? 0.5 : 1,
                }}
                onClick={() => addTag(tag)}
              >
                {tag}
              </button>
            ))}
          </div>
        )}
        
        {/* Input */}
        <div style={{ display: 'flex', gap: 4, alignItems: 'end', flex: 1 }}>
          <input
            type="text"
            className="field"
            placeholder={availableTags.length > 0 ? "Type new tag or click above..." : "Add tag..."}
            value={inputValue}
            onChange={(e) => onInputChange(e.target.value)}
            onKeyPress={handleKeyPress}
            autoFocus
            style={{ flex: topTags.length === 0 ? 1 : undefined }}
          />
          {inputValue.trim() && (
            <button
              className="btn btn-secondary"
              type="button"
              onClick={() => addTag(inputValue)}
              style={{ flexShrink: 0 }}
            >
              Add
            </button>
          )}
        </div>
      </div>
      
      {availableTags.length > topTags.length && (
        <p style={{ fontSize: 11, opacity: 0.6, margin: '4px 0 0 0' }}>
          +{availableTags.length - topTags.length} more past tags...
        </p>
      )}
    </div>
  )
}

