'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import api from '@/lib/api';
import { Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';

export default function Profile() {
  const { user, setUser } = useAuth();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  
  const [formData, setFormData] = useState({
    name: '',
    bio: '',
    profile_image: '',
    links: '',
    password: ''
  });

  useEffect(() => {
    if (user) {
      setFormData({
        name: user.name || '',
        bio: user.bio || '',
        profile_image: user.profile_image || '',
        links: Array.isArray(user.links) ? user.links.join('\n') : '',
        password: '' // Keep password empty unless changing
      });
    }
  }, [user]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    try {
      const updateData: any = {
        name: formData.name,
        bio: formData.bio,
        profile_image: formData.profile_image,
        links: formData.links
          .split('\n')
          .map((link) => link.trim())
          .filter(Boolean),
      };
      
      // Only include password if changed
      if (formData.password) {
        updateData.password = formData.password;
      }

      const res = await api.put('/users/profile', updateData);
      setUser(res.data.data); // Update local context
      setMessage('Profile updated successfully!');
      
      // Clear password field after update
      setFormData(prev => ({ ...prev, password: '' }));
      
      setTimeout(() => setMessage(''), 3000);
    } catch (err: any) {
      setMessage(err.response?.data?.detail || 'Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: '600px', margin: '0 auto', padding: '40px 20px' }}>
      <h1 style={{ fontSize: '2.5rem', marginBottom: '30px' }}>Profile Settings</h1>
      
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        style={{ background: 'var(--surface-color)', padding: '40px', borderRadius: '16px', border: '1px solid var(--border-color)' }}
      >
        {message && (
          <div style={{ 
            background: message.includes('success') ? 'rgba(75, 192, 192, 0.1)' : 'rgba(255,101,132,0.1)', 
            color: message.includes('success') ? '#4bc0c0' : '#ff6584', 
            padding: '12px', 
            borderRadius: '8px', 
            marginBottom: '20px', 
            fontSize: '14px', 
            textAlign: 'center' 
          }}>
            {message}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', color: 'var(--text-secondary)' }}>Full Name</label>
            <input required type="text" name="name" value={formData.name} onChange={handleChange} style={{ width: '100%', padding: '14px', background: 'var(--bg-color)', border: '1px solid var(--border-color)', borderRadius: '8px', color: 'white', fontSize: '16px' }} />
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', color: 'var(--text-secondary)' }}>Biography</label>
            <textarea name="bio" value={formData.bio} onChange={handleChange} rows={4} placeholder="Tell attendees about yourself..." style={{ width: '100%', padding: '14px', background: 'var(--bg-color)', border: '1px solid var(--border-color)', borderRadius: '8px', color: 'white', fontSize: '16px', resize: 'vertical' }} />
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', color: 'var(--text-secondary)' }}>Profile Image URL</label>
            <input type="url" name="profile_image" value={formData.profile_image} onChange={handleChange} style={{ width: '100%', padding: '14px', background: 'var(--bg-color)', border: '1px solid var(--border-color)', borderRadius: '8px', color: 'white', fontSize: '16px' }} />
            {formData.profile_image && (
              <div style={{ marginTop: '10px' }}>
                <img src={formData.profile_image} alt="Preview" style={{ width: '60px', height: '60px', borderRadius: '50%', objectFit: 'cover' }} />
              </div>
            )}
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', color: 'var(--text-secondary)' }}>Profile Links</label>
            <textarea
              name="links"
              value={formData.links}
              onChange={handleChange}
              rows={4}
              placeholder="One URL per line: LinkedIn, GitHub, website, etc."
              style={{ width: '100%', padding: '14px', background: 'var(--bg-color)', border: '1px solid var(--border-color)', borderRadius: '8px', color: 'white', fontSize: '16px', resize: 'vertical' }}
            />
          </div>

          <hr style={{ border: 'none', borderTop: '1px solid var(--border-color)', margin: '10px 0' }} />

          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', color: 'var(--text-secondary)' }}>New Password <span style={{ fontSize: '12px' }}>(Leave blank to keep current)</span></label>
            <input type="password" name="password" value={formData.password} onChange={handleChange} placeholder="••••••••" style={{ width: '100%', padding: '14px', background: 'var(--bg-color)', border: '1px solid var(--border-color)', borderRadius: '8px', color: 'white', fontSize: '16px' }} />
          </div>

          <button 
            type="submit" 
            disabled={loading}
            style={{ width: '100%', padding: '16px', background: 'var(--primary-color)', color: 'white', border: 'none', borderRadius: '8px', fontSize: '1.1rem', fontWeight: 'bold', cursor: loading ? 'not-allowed' : 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', marginTop: '10px' }}
          >
            {loading ? <Loader2 className="animate-spin" size={24} /> : 'Save Changes'}
          </button>
        </form>
      </motion.div>
    </div>
  );
}
