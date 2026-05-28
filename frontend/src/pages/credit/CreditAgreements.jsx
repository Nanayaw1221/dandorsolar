import { useState, useEffect } from 'react';
import api from '../../lib/api';
import toast from 'react-hot-toast';
import Table from '../../components/ui/Table';
import Modal from '../../components/ui/Modal';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Select from '../../components/ui/Select';
import Badge from '../../components/ui/Badge';

const GHS = (n) => `GH₵${Number(n || 0).toLocaleString('en-GH', { minimumFractionDigits: 2 })}`;

const statusVariant = { Active: 'info', Completed: 'success', Overdue: 'error', Defaulted: 'error' };

const emptyForm = {
  // Step 1: Customer
  customerName: '', customerPhone: '', customerAddress: '', customerIdNumber: '',
  // Step 2: Guarantor
  guarantorName: '', guarantorPhone: '', guarantorAddress: '',
  // Step 3: Terms
  totalAmount: '', downPayment: '', interestRate: '', startDate: new Date().toISOString().split('T')[0], endDate: '',
  // Step 4: Products
  products: [{ name: '', qty: 1, price: 0 }],
  notes: '',
};

export default function CreditAgreements() {
  const [agreements, setAgreements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [step, setStep] = useState(1);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [payModal, setPayModal] = useState(false);
  const [selectedAg, setSelectedAg] = useState(null);
  const [payAmount, setPayAmount] = useState('');
  const [paying, setPaying] = useState(false);
  const [viewModal, setViewModal] = useState(false);
  const [viewItem, setViewItem] = useState(null);

  useEffect(() => { fetchAgreements(); }, []);

  const fetchAgreements = async () => {
    setLoading(true);
    try {
      const data = await api.get('/credit-agreements');
      setAgreements(Array.isArray(data?.data) ? data.data : []);
    } catch { setAgreements([]); } finally { setLoading(false); }
  };

  const openCreate = () => { setForm(emptyForm); setStep(1); setModalOpen(true); };

  const addProduct = () => setForm(f => ({ ...f, products: [...f.products, { name: '', qty: 1, price: 0 }] }));
  const removeProduct = (i) => setForm(f => ({ ...f, products: f.products.filter((_, idx) => idx !== i) }));
  const updateProduct = (i, field, val) => {
    setForm(f => { const ps = [...f.products]; ps[i] = { ...ps[i], [field]: val }; return { ...f, products: ps }; });
  };

  const remaining = (ag) => {
    const total = ag.totalAmount + ((ag.totalAmount * (ag.interestRate || 0)) / 100);
    return Math.max(0, total - (ag.amountPaid || 0));
  };

  const handleSave = async () => {
    if (!form.customerName.trim()) { toast.error('Customer name required'); return; }
    if (!form.totalAmount || parseFloat(form.totalAmount) <= 0) { toast.error('Total amount required'); return; }
    setSaving(true);
    try {
      await api.post('/credit-agreements', {
        ...form,
        totalAmount: parseFloat(form.totalAmount),
        downPayment: parseFloat(form.downPayment) || 0,
        interestRate: parseFloat(form.interestRate) || 0,
      });
      toast.success('Credit agreement created');
      setModalOpen(false);
      fetchAgreements();
    } catch (err) { toast.error(err?.message || 'Failed to create agreement'); } finally { setSaving(false); }
  };

  const handlePayment = async () => {
    const amt = parseFloat(payAmount || 0);
    if (!amt || amt <= 0) { toast.error('Enter valid payment amount'); return; }
    setPaying(true);
    try {
      await api.post(`/credit-agreements/${selectedAg._id}/payment`, { amount: amt });
      toast.success('Payment recorded');
      setPayModal(false);
      setPayAmount('');
      fetchAgreements();
    } catch (err) { toast.error(err?.message || 'Failed to record payment'); } finally { setPaying(false); }
  };

  const columns = [
    { key: 'customerName', header: 'Customer', render: (v, row) => (
      <div><p className="font-semibold text-gray-900">{v}</p><p className="text-xs text-gray-400">{row.customerPhone}</p></div>
    )},
    { key: 'totalAmount', header: 'Total', render: v => GHS(v) },
    { key: 'downPayment', header: 'Down Payment', render: v => <span className="text-green-600 font-medium">{GHS(v)}</span> },
    { key: 'remaining', header: 'Remaining', render: (_, row) => <span className="font-bold text-red-600">{GHS(remaining(row))}</span> },
    { key: 'startDate', header: 'Start', render: v => v ? new Date(v).toLocaleDateString('en-GH') : '—' },
    { key: 'endDate', header: 'End', render: v => v ? new Date(v).toLocaleDateString('en-GH') : '—' },
    { key: 'status', header: 'Status', render: v => <Badge variant={statusVariant[v] || 'default'}>{v || 'Active'}</Badge> },
    { key: 'actions', header: 'Actions', render: (_, row) => (
      <div className="flex gap-1">
        <button onClick={() => { setViewItem(row); setViewModal(true); }} className="px-2 py-1.5 text-xs bg-orange-50 text-orange-600 rounded-lg hover:bg-orange-100 font-medium transition-colors">View</button>
        {remaining(row) > 0 && (
          <button onClick={() => { setSelectedAg(row); setPayModal(true); }} className="px-2 py-1.5 text-xs bg-green-50 text-green-600 rounded-lg hover:bg-green-100 font-medium transition-colors">Pay</button>
        )}
      </div>
    )},
  ];

  const steps = ['Customer Info', 'Guarantor', 'Agreement Terms', 'Products'];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Credit Agreements</h1>
          <p className="text-sm text-gray-500 mt-1">{agreements.length} agreements</p>
        </div>
        <Button variant="primary" onClick={openCreate}>+ New Agreement</Button>
      </div>

      <Table columns={columns} data={agreements} loading={loading} emptyMessage="No credit agreements found" />

      {/* Multi-step Create Modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="New Credit Agreement" size="lg"
        footer={
          <div className="flex items-center justify-between w-full">
            <Button variant="ghost" onClick={() => step > 1 ? setStep(step - 1) : setModalOpen(false)}>
              {step > 1 ? '← Back' : 'Cancel'}
            </Button>
            <div className="flex gap-2">
              {step < 4 ? (
                <Button variant="primary" onClick={() => setStep(step + 1)}>Next →</Button>
              ) : (
                <Button variant="primary" loading={saving} onClick={handleSave}>Create Agreement</Button>
              )}
            </div>
          </div>
        }
      >
        {/* Step Progress */}
        <div className="flex items-center gap-1 mb-6">
          {steps.map((s, i) => (
            <div key={i} className="flex items-center flex-1">
              <div className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold flex-shrink-0 ${i + 1 <= step ? 'bg-orange-500 text-white' : 'bg-gray-200 text-gray-500'}`}>
                {i + 1}
              </div>
              <p className={`text-xs ml-1.5 hidden sm:block ${i + 1 === step ? 'text-orange-600 font-semibold' : 'text-gray-400'}`}>{s}</p>
              {i < steps.length - 1 && <div className={`flex-1 h-0.5 mx-2 ${i + 1 < step ? 'bg-orange-500' : 'bg-gray-200'}`} />}
            </div>
          ))}
        </div>

        {step === 1 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2"><Input label="Customer Name *" value={form.customerName} onChange={e => setForm({ ...form, customerName: e.target.value })} placeholder="Full legal name" required /></div>
            <Input label="Phone Number" value={form.customerPhone} onChange={e => setForm({ ...form, customerPhone: e.target.value })} placeholder="+233..." />
            <Input label="ID Number" value={form.customerIdNumber} onChange={e => setForm({ ...form, customerIdNumber: e.target.value })} placeholder="Ghana Card / ID" />
            <div className="sm:col-span-2"><Input label="Address" value={form.customerAddress} onChange={e => setForm({ ...form, customerAddress: e.target.value })} placeholder="Physical address" /></div>
          </div>
        )}

        {step === 2 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2"><Input label="Guarantor Name" value={form.guarantorName} onChange={e => setForm({ ...form, guarantorName: e.target.value })} placeholder="Full name" /></div>
            <Input label="Guarantor Phone" value={form.guarantorPhone} onChange={e => setForm({ ...form, guarantorPhone: e.target.value })} placeholder="+233..." />
            <div className="sm:col-span-2"><Input label="Guarantor Address" value={form.guarantorAddress} onChange={e => setForm({ ...form, guarantorAddress: e.target.value })} placeholder="Physical address" /></div>
          </div>
        )}

        {step === 3 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input label="Total Amount (GH₵) *" type="number" value={form.totalAmount} onChange={e => setForm({ ...form, totalAmount: e.target.value })} placeholder="0.00" min="0" step="0.01" required />
            <Input label="Down Payment (GH₵)" type="number" value={form.downPayment} onChange={e => setForm({ ...form, downPayment: e.target.value })} placeholder="0.00" min="0" step="0.01" />
            <Input label="Interest Rate (%)" type="number" value={form.interestRate} onChange={e => setForm({ ...form, interestRate: e.target.value })} placeholder="0" min="0" max="100" />
            <Input label="Start Date" type="date" value={form.startDate} onChange={e => setForm({ ...form, startDate: e.target.value })} />
            <Input label="End Date" type="date" value={form.endDate} onChange={e => setForm({ ...form, endDate: e.target.value })} />
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
              <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={3} className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 resize-none" placeholder="Additional terms or notes" />
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-gray-700">Products / Items</label>
              <Button variant="secondary" size="sm" onClick={addProduct}>+ Add</Button>
            </div>
            {form.products.map((p, i) => (
              <div key={i} className="grid grid-cols-12 gap-2 items-end p-3 bg-gray-50 rounded-lg">
                <div className="col-span-6">
                  <Input label={i === 0 ? "Product/Item Name" : undefined} value={p.name} onChange={e => updateProduct(i, 'name', e.target.value)} placeholder="Item name" />
                </div>
                <div className="col-span-2">
                  <Input label={i === 0 ? "Qty" : undefined} type="number" value={p.qty} onChange={e => updateProduct(i, 'qty', e.target.value)} min="1" />
                </div>
                <div className="col-span-3">
                  <Input label={i === 0 ? "Price" : undefined} type="number" value={p.price} onChange={e => updateProduct(i, 'price', e.target.value)} min="0" step="0.01" />
                </div>
                <div className="col-span-1 pb-2">
                  {form.products.length > 1 && (
                    <button onClick={() => removeProduct(i)} className="w-7 h-7 flex items-center justify-center text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                  )}
                </div>
              </div>
            ))}
            <div className="bg-orange-50 p-3 rounded-lg text-sm">
              <div className="flex justify-between font-semibold">
                <span>Total Agreement Value:</span>
                <span className="text-orange-600">{GHS(parseFloat(form.totalAmount) || 0)}</span>
              </div>
              {parseFloat(form.downPayment) > 0 && (
                <div className="flex justify-between text-green-600 mt-1">
                  <span>After Down Payment:</span>
                  <span>{GHS((parseFloat(form.totalAmount) || 0) - (parseFloat(form.downPayment) || 0))}</span>
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* Payment Modal */}
      <Modal open={payModal} onClose={() => setPayModal(false)} title="Record Payment" size="sm"
        footer={<><Button variant="ghost" onClick={() => setPayModal(false)}>Cancel</Button><Button variant="primary" loading={paying} onClick={handlePayment}>Record Payment</Button></>}>
        {selectedAg && (
          <div className="space-y-4">
            <div className="bg-orange-50 rounded-lg p-4">
              <p className="font-semibold">{selectedAg.customerName}</p>
              <div className="flex justify-between mt-2 text-sm">
                <span className="text-gray-500">Remaining</span>
                <span className="font-bold text-red-600">{GHS(remaining(selectedAg))}</span>
              </div>
            </div>
            <Input label="Payment Amount (GH₵)" type="number" value={payAmount} onChange={e => setPayAmount(e.target.value)} placeholder="0.00" min="0.01" step="0.01" />
          </div>
        )}
      </Modal>

      {/* View Agreement Modal */}
      <Modal open={viewModal} onClose={() => setViewModal(false)} title="Agreement Details" size="lg"
        footer={<><Button variant="secondary" onClick={window.print}>🖨️ Print</Button><Button variant="ghost" onClick={() => setViewModal(false)}>Close</Button></>}>
        {viewItem && (
          <div className="space-y-4 text-sm">
            <div className="text-center pb-3 border-b">
              <h3 className="font-black text-orange-600 text-lg">DAN & DOR SOLAR COMPANY LIMITED</h3>
              <p className="text-gray-500">Credit Agreement</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><span className="text-gray-500 block">Customer</span><span className="font-semibold">{viewItem.customerName}</span></div>
              <div><span className="text-gray-500 block">Phone</span><span className="font-semibold">{viewItem.customerPhone || '—'}</span></div>
              <div><span className="text-gray-500 block">Address</span><span className="font-semibold">{viewItem.customerAddress || '—'}</span></div>
              <div><span className="text-gray-500 block">ID Number</span><span className="font-semibold">{viewItem.customerIdNumber || '—'}</span></div>
            </div>
            <div className="border-t pt-3">
              <p className="font-semibold text-gray-700 mb-2">Guarantor</p>
              <div className="grid grid-cols-2 gap-3">
                <div><span className="text-gray-500 block">Name</span><span className="font-semibold">{viewItem.guarantorName || '—'}</span></div>
                <div><span className="text-gray-500 block">Phone</span><span className="font-semibold">{viewItem.guarantorPhone || '—'}</span></div>
              </div>
            </div>
            <div className="border-t pt-3">
              <p className="font-semibold text-gray-700 mb-2">Financial Terms</p>
              <div className="grid grid-cols-2 gap-3">
                <div><span className="text-gray-500 block">Total Amount</span><span className="font-bold text-orange-600">{GHS(viewItem.totalAmount)}</span></div>
                <div><span className="text-gray-500 block">Down Payment</span><span className="font-bold text-green-600">{GHS(viewItem.downPayment)}</span></div>
                <div><span className="text-gray-500 block">Interest Rate</span><span className="font-semibold">{viewItem.interestRate || 0}%</span></div>
                <div><span className="text-gray-500 block">Remaining</span><span className="font-bold text-red-600">{GHS(remaining(viewItem))}</span></div>
                <div><span className="text-gray-500 block">Start Date</span><span className="font-semibold">{viewItem.startDate ? new Date(viewItem.startDate).toLocaleDateString() : '—'}</span></div>
                <div><span className="text-gray-500 block">End Date</span><span className="font-semibold">{viewItem.endDate ? new Date(viewItem.endDate).toLocaleDateString() : '—'}</span></div>
              </div>
            </div>
            {viewItem.notes && <div className="bg-gray-50 p-3 rounded-lg"><p className="text-gray-600">{viewItem.notes}</p></div>}
          </div>
        )}
      </Modal>
    </div>
  );
}
