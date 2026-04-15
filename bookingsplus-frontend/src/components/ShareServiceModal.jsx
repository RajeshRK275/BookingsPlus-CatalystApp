import React, { useState } from 'react';
import { X, Copy, Check, Download, Link2 } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';

const TABS = ['Shorten Link', 'One time Link', 'Embed as Widget', 'Copy Time Slots'];

const ShareServiceModal = ({ isOpen, onClose, service }) => {
    const [copied, setCopied] = useState(false);
    const [activeTab, setActiveTab] = useState('Shorten Link');

    if (!isOpen || !service) return null;

    const bookingUrl = `${window.location.origin}/app/book/${service.id}`;

    const handleCopy = () => {
        navigator.clipboard.writeText(bookingUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleDownloadQR = () => {
        const svg = document.getElementById('share-qr-code');
        if (!svg) return;
        const svgData = new XMLSerializer().serializeToString(svg);
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const img = new Image();
        img.onload = () => {
            canvas.width = img.width;
            canvas.height = img.height;
            ctx.drawImage(img, 0, 0);
            const a = document.createElement('a');
            a.download = `${service.name}-QR.png`;
            a.href = canvas.toDataURL('image/png');
            a.click();
        };
        img.src = 'data:image/svg+xml;base64,' + btoa(svgData);
    };

    return (
        <div style={{
            position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.4)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }} onClick={onClose}>
            <div onClick={e => e.stopPropagation()} style={{
                backgroundColor: 'white', borderRadius: '12px', width: '540px',
                boxShadow: '0 20px 60px rgba(0,0,0,0.15)', overflow: 'hidden'
            }}>
                {/* Header */}
                <div style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '20px 24px', borderBottom: '1px solid var(--pk-border)'
                }}>
                    <h3 style={{ fontSize: '16px', fontWeight: 600 }}>Share - {service.name}</h3>
                    <button onClick={onClose} style={{
                        background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF', padding: '4px'
                    }}><X size={20} /></button>
                </div>

                <div style={{ padding: '24px' }}>
                    {/* URL + Copy */}
                    <div style={{
                        display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '24px'
                    }}>
                        <div style={{
                            flex: 1, display: 'flex', alignItems: 'center', gap: '8px',
                            padding: '10px 14px', backgroundColor: '#F9FAFB',
                            border: '1px solid var(--pk-border)', borderRadius: '6px',
                            overflow: 'hidden'
                        }}>
                            <span style={{
                                fontSize: '13px', color: 'var(--pk-text-main)',
                                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex: 1
                            }}>{bookingUrl}</span>
                            <Link2 size={14} color="#9CA3AF" style={{ cursor: 'pointer', flexShrink: 0 }} />
                        </div>
                        <button onClick={handleCopy} style={{
                            display: 'flex', alignItems: 'center', gap: '6px',
                            padding: '10px 20px', backgroundColor: 'var(--pk-primary)', color: 'white',
                            border: 'none', borderRadius: '6px', cursor: 'pointer',
                            fontSize: '14px', fontWeight: 500, whiteSpace: 'nowrap'
                        }}>
                            {copied ? <><Check size={14} /> Copied!</> : <><Copy size={14} /> Copy</>}
                        </button>
                    </div>

                    {/* QR Code */}
                    <div style={{
                        display: 'flex', alignItems: 'center', gap: '20px',
                        padding: '20px', backgroundColor: '#FAFAFA',
                        border: '1px solid var(--pk-border)', borderRadius: '8px',
                        marginBottom: '24px'
                    }}>
                        <div style={{
                            width: '100px', height: '100px', backgroundColor: 'white',
                            border: '1px solid var(--pk-border)', borderRadius: '6px',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '8px'
                        }}>
                            <QRCodeSVG id="share-qr-code" value={bookingUrl} size={80} />
                        </div>
                        <div>
                            <p style={{ fontSize: '13px', color: 'var(--pk-text-muted)', marginBottom: '12px', lineHeight: '1.5' }}>
                                Share this QR code to open the booking page instantly on any device.
                            </p>
                            <button onClick={handleDownloadQR} style={{
                                display: 'flex', alignItems: 'center', gap: '6px',
                                background: 'none', border: 'none', cursor: 'pointer',
                                color: 'var(--pk-primary)', fontSize: '13px', fontWeight: 500
                            }}>
                                <Download size={14} /> Download QR
                            </button>
                        </div>
                    </div>

                    {/* Tabs */}
                    <div style={{
                        display: 'flex', gap: '4px', borderBottom: '1px solid var(--pk-border)',
                        marginBottom: '20px'
                    }}>
                        {TABS.map(tab => (
                            <div
                                key={tab}
                                onClick={() => setActiveTab(tab)}
                                style={{
                                    padding: '10px 16px', cursor: 'pointer', fontSize: '13px',
                                    fontWeight: activeTab === tab ? 500 : 400,
                                    color: activeTab === tab ? 'var(--pk-text-main)' : 'var(--pk-text-muted)',
                                    borderBottom: activeTab === tab ? '2px solid var(--pk-primary)' : '2px solid transparent',
                                    transition: 'all 0.15s'
                                }}
                            >{tab}</div>
                        ))}
                    </div>

                    {/* Tab Content */}
                    <div style={{ textAlign: 'center' }}>
                        <button style={{
                            padding: '10px 24px', border: '1px solid var(--pk-border)',
                            borderRadius: '20px', backgroundColor: 'white', cursor: 'pointer',
                            fontSize: '13px', color: 'var(--pk-text-muted)'
                        }}>Generate Shortened URL</button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ShareServiceModal;
