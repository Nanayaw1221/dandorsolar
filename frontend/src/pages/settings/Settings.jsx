import { useState, useEffect } from 'react';
import api from '../../lib/api';
import toast from 'react-hot-toast';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';

export default function Settings() {
  const [activeTab, setActiveTab] = useState('company');
  const [saving, setSaving] = useState(false);
  const [company, setCompany] = useState({ name: 'DAN & DOR SOLAR COMPANY LIMITED', address: '', phone: '', email: '', logo: '' });
  const [notifications, setNotifications] = useState({ lowStockThreshold: 10, debtDueDaysAlert: 7, emailAlerts: false });
  const [emailConfig, setEmailConfig] = useState({ smtpHost: '', smtpPort: 587, smtpUser: '', smtpPass: '', fromEmail: '' });

  useEffect(() => { fetchSettings(); }, []);

  const fetchSettings = async () => {
    try {
      const res = await api.get('/settings');
      const s = res?.data;
      if (!s) return;
      setCompany({
        name: s.company_name || 'DAN & DOR SOLAR COMPANY LIMITED',
        address: s.company_address || '',
        phone: s.company_phone || '',
        email: s.company_email || '',
        logo: s.logo_url || '',
      });
      setNotifications({
        lowStockThreshold: s.low_stock_alert || 10,
        debtDueDaysAlert: 7,
        emailAlerts: s.notification_settings?.email_notifications || false,
      });
      setEmailConfig({
        smtpHost: s.email_config?.smtp_host || '',
        smtpPort: s.email_config?.smtp_port || 587,
        smtpUser: s.email_config?.smtp_user || '',
        smtpPass: s.email_config?.smtp_pass || '',
        fromEmail: s.email_config?.from_email || '',
      });
    } catch { }
  };

  const handleSave = async (section) => {
    setSaving(true);
    try {
      let payload = {};
      if (section === 'company') {
        payload = {
          company_name: company.name,
          company_address: company.address,
          company_phone: company.phone,
          company_email: company.email,
          logo_url: company.logo,
        };
      } else if (section === 'notifications') {
        payload = {
          low_stock_alert: notifications.lowStockThreshold,
          notification_settings: { email_notifications: notifications.emailAlerts },
        };
      } else {
        payload = {
          email_config: {
            smtp_host: emailConfig.smtpHost,
            smtp_port: emailConfig.smtpPort,
            smtp_user: emailConfig.smtpUser,
            smtp_pass: emailConfig.smtpPass,
            from_email: emailConfig.fromEmail,
            enabled: true,
          },
        };
      }
      await api.put('/settings', payload);
      toast.success('Settings saved successfully');
    } catch (err) { toast.error(err?.message || 'Failed to save settings'); } finally { setSaving(false); }
  };

  const tabs = [
    { id: 'company', label: 'Company Info', icon: '🏢' },
    { id: 'notifications', label: 'Notifications', icon: '🔔' },
    { id: 'system', label: 'System / Email', icon: '⚙️' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-sm text-gray-500 mt-1">System configuration (Super Admin only)</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === t.id ? 'bg-orange-500 text-white' : 'bg-white text-gray-600 border border-gray-200 hover:bg-orange-50'}`}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {activeTab === 'company' && (
        <Card title="Company Information" accent>
          <div className="space-y-4 max-w-lg">
            <Input label="Company Name" value={company.name} onChange={e => setCompany({ ...company, name: e.target.value })} />
            <Input label="Address" value={company.address} onChange={e => setCompany({ ...company, address: e.target.value })} placeholder="Physical address" />
            <Input label="Phone" value={company.phone} onChange={e => setCompany({ ...company, phone: e.target.value })} placeholder="+233..." />
            <Input label="Email" type="email" value={company.email} onChange={e => setCompany({ ...company, email: e.target.value })} placeholder="company@example.com" />
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Company Logo</label>
              <input type="file" accept="image/*" className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500" onChange={e => {
                const file = e.target.files[0];
                if (file) {
                  const reader = new FileReader();
                  reader.onloadend = () => setCompany({ ...company, logo: reader.result });
                  reader.readAsDataURL(file);
                }
              }} />
              {company.logo && <img src={company.logo} alt="Logo" className="mt-2 h-16 object-contain" />}
            </div>
            <Button variant="primary" loading={saving} onClick={() => handleSave('company')}>Save Company Info</Button>
          </div>
        </Card>
      )}

      {activeTab === 'notifications' && (
        <Card title="Notification Settings" accent>
          <div className="space-y-4 max-w-lg">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Low Stock Alert Threshold</label>
              <input type="number" value={notifications.lowStockThreshold} onChange={e => setNotifications({ ...notifications, lowStockThreshold: parseInt(e.target.value) || 0 })}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500" min="1" />
              <p className="text-xs text-gray-400 mt-1">Alert when product quantity falls below this number</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Debt Due Date Alert (days before)</label>
              <input type="number" value={notifications.debtDueDaysAlert} onChange={e => setNotifications({ ...notifications, debtDueDaysAlert: parseInt(e.target.value) || 0 })}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500" min="1" />
              <p className="text-xs text-gray-400 mt-1">Alert this many days before a debt is due</p>
            </div>
            <div className="flex items-center gap-3">
              <input type="checkbox" id="emailAlerts" checked={notifications.emailAlerts} onChange={e => setNotifications({ ...notifications, emailAlerts: e.target.checked })} className="w-4 h-4 accent-orange-500" />
              <label htmlFor="emailAlerts" className="text-sm font-medium text-gray-700">Enable Email Alerts</label>
            </div>
            <Button variant="primary" loading={saving} onClick={() => handleSave('notifications')}>Save Notification Settings</Button>
          </div>
        </Card>
      )}

      {activeTab === 'system' && (
        <Card title="Email / SMTP Configuration" accent>
          <div className="space-y-4 max-w-lg">
            <Input label="SMTP Host" value={emailConfig.smtpHost} onChange={e => setEmailConfig({ ...emailConfig, smtpHost: e.target.value })} placeholder="smtp.gmail.com" />
            <Input label="SMTP Port" type="number" value={emailConfig.smtpPort} onChange={e => setEmailConfig({ ...emailConfig, smtpPort: parseInt(e.target.value) })} placeholder="587" />
            <Input label="SMTP Username" value={emailConfig.smtpUser} onChange={e => setEmailConfig({ ...emailConfig, smtpUser: e.target.value })} placeholder="your-email@gmail.com" />
            <Input label="SMTP Password" type="password" value={emailConfig.smtpPass} onChange={e => setEmailConfig({ ...emailConfig, smtpPass: e.target.value })} placeholder="App password" />
            <Input label="From Email" type="email" value={emailConfig.fromEmail} onChange={e => setEmailConfig({ ...emailConfig, fromEmail: e.target.value })} placeholder="noreply@company.com" />
            <Button variant="primary" loading={saving} onClick={() => handleSave('email')}>Save Email Config</Button>
          </div>
        </Card>
      )}
    </div>
  );
}
