import { useState, useRef, useEffect, useCallback } from 'react';
import api from '../../lib/api';
import toast from 'react-hot-toast';
import Modal from '../../components/ui/Modal';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Select from '../../components/ui/Select';

const GHS = (n) => `GH₵${Number(n || 0).toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function POS() {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [showSearch, setShowSearch] = useState(false);
  const [barcodeInput, setBarcodeInput] = useState('');
  const [cart, setCart] = useState([]);
  const [discount, setDiscount] = useState(0);
  const [customer, setCustomer] = useState({ name: '', phone: '' });
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [amountReceived, setAmountReceived] = useState('');
  const [loading, setLoading] = useState(false);
  const [receiptModal, setReceiptModal] = useState(false);
  const [shortPayModal, setShortPayModal] = useState(false);
  const [lastSale, setLastSale] = useState(null);
  const [shortPayData, setShortPayData] = useState({ amountPaid: '', dueDate: '', customerName: '', customerPhone: '' });
  const searchRef = useRef(null);

  const subtotal = cart.reduce((sum, item) => sum + item.price * item.qty, 0);
  const discountAmt = (subtotal * discount) / 100;
  const total = subtotal - discountAmt;
  const change = parseFloat(amountReceived || 0) - total;

  const searchProducts = useCallback(async (query) => {
    if (!query.trim()) { setSearchResults([]); return; }
    try {
      const data = await api.get(`/products/search?q=${encodeURIComponent(query)}&limit=8`);
      setSearchResults(data?.data || data?.products || []);
    } catch { setSearchResults([]); }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => searchProducts(searchQuery), 300);
    return () => clearTimeout(timer);
  }, [searchQuery, searchProducts]);

  const addToCart = (product) => {
    setCart(prev => {
      const exists = prev.find(i => i._id === product._id);
      if (exists) return prev.map(i => i._id === product._id ? { ...i, qty: i.qty + 1 } : i);
      return [...prev, { ...product, qty: 1, price: product.selling_price || product.sellingPrice || product.price || 0 }];
    });
    setSearchQuery('');
    setSearchResults([]);
    setShowSearch(false);
  };

  const lookupBarcode = async () => {
    if (!barcodeInput.trim()) return;
    try {
      const data = await api.get(`/products/barcode/${barcodeInput.trim()}`);
      const product = data?.data || data?.product || data;
      if (product?._id) {
        addToCart(product);
        setBarcodeInput('');
        toast.success(`Added: ${product.name}`);
      } else { toast.error('Product not found'); }
    } catch { toast.error('Product not found'); }
  };

  const updateQty = (id, delta) => setCart(prev => prev.map(i => i._id === id ? { ...i, qty: Math.max(1, i.qty + delta) } : i));
  const removeItem = (id) => setCart(prev => prev.filter(i => i._id !== id));
  const updatePrice = (id, newPrice) => {
    const val = parseFloat(newPrice);
    if (!isNaN(val) && val >= 0) setCart(prev => prev.map(i => i._id === id ? { ...i, price: val } : i));
  };

  const handleCompleteSale = async () => {
    if (cart.length === 0) { toast.error('Cart is empty'); return; }
    const received = parseFloat(amountReceived || 0);
    if (received < total) { toast.error('Amount received is less than total due'); return; }
    setLoading(true);
    try {
      const result = await api.post('/sales', {
        customer_name: customer.name || '',
        customer_phone: customer.phone || '',
        items: cart.map(i => ({ product_id: i._id, quantity: i.qty, unit_price: i.price })),
        discount,
        discount_type: 'percentage',
        payment_method: paymentMethod,
        payment_status: 'paid',
      });
      const invoiceNo = result?.data?.sale?.invoice_no || 'INV-' + Date.now();
      setLastSale({
        invoiceNo,
        date: new Date().toLocaleString(),
        customerName: customer.name,
        items: cart.map(i => ({ name: i.name, qty: i.qty, price: i.price })),
        subtotal, discount, discountAmount: discountAmt, total,
        paymentMethod, amountReceived: received, change: received - total,
        isShortPayment: false, debtAmount: 0,
      });
      setCart([]); setDiscount(0); setAmountReceived(''); setCustomer({ name: '', phone: '' });
      setReceiptModal(true);
      toast.success(`Sale completed! Invoice: ${invoiceNo}`);
    } catch (err) { toast.error(err?.message || 'Failed to complete sale'); } finally { setLoading(false); }
  };

  const handleShortPayment = async () => {
    if (cart.length === 0) { toast.error('Cart is empty'); return; }
    if (!shortPayData.customerName.trim()) { toast.error('Customer name is required'); return; }
    const paid = parseFloat(shortPayData.amountPaid || 0);
    const debt = total - paid;
    if (paid <= 0) { toast.error('Amount paid must be greater than 0'); return; }
    if (debt <= 0) { toast.error('Use Complete Sale for full payment'); return; }
    setLoading(true);
    try {
      const result = await api.post('/sales', {
        customer_name: shortPayData.customerName,
        customer_phone: shortPayData.customerPhone,
        items: cart.map(i => ({ product_id: i._id, quantity: i.qty, unit_price: i.price })),
        discount,
        discount_type: 'percentage',
        payment_method: paymentMethod,
        payment_status: 'partial',
        total_amount: paid,
        due_date: shortPayData.dueDate || undefined,
      });
      const invoiceNo = result?.data?.sale?.invoice_no || 'INV-' + Date.now();
      setLastSale({
        invoiceNo,
        date: new Date().toLocaleString(),
        customerName: shortPayData.customerName,
        items: cart.map(i => ({ name: i.name, qty: i.qty, price: i.price })),
        subtotal, discount, discountAmount: discountAmt, total,
        paymentMethod, amountReceived: paid, change: 0,
        isShortPayment: true, debtAmount: debt,
      });
      setCart([]); setDiscount(0); setAmountReceived(''); setCustomer({ name: '', phone: '' });
      setShortPayModal(false);
      setShortPayData({ amountPaid: '', dueDate: '', customerName: '', customerPhone: '' });
      setReceiptModal(true);
      toast.success(`Sale recorded! Outstanding: GH₵${debt.toFixed(2)}`);
    } catch (err) { toast.error(err?.message || 'Failed to process short payment'); } finally { setLoading(false); }
  };

  return (
    <div className="flex gap-4 h-[calc(100vh-140px)] min-h-[600px]">
      {/* Left Panel */}
      <div className="flex-1 flex flex-col gap-4 min-w-0">
        <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
          <h2 className="text-lg font-bold text-gray-900 mb-3">Point of Sale</h2>

          {/* Product Search */}
          <div className="relative mb-3">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              ref={searchRef}
              value={searchQuery}
              onChange={e => { setSearchQuery(e.target.value); setShowSearch(true); }}
              onFocus={() => setShowSearch(true)}
              onBlur={() => setTimeout(() => setShowSearch(false), 200)}
              placeholder="Search product by name..."
              className="w-full pl-9 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
            {showSearch && searchResults.length > 0 && (
              <div className="absolute top-full left-0 right-0 z-20 bg-white border border-gray-200 rounded-lg shadow-lg mt-1 max-h-52 overflow-y-auto">
                {searchResults.map(p => (
                  <button key={p._id} onMouseDown={() => addToCart(p)} className="w-full text-left px-4 py-2.5 hover:bg-orange-50 transition-colors border-b border-gray-100 last:border-0">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-900">{p.name}</p>
                        <p className="text-xs text-gray-500">{p.barcode || ''} &bull; Stock: {p.quantity ?? '?'}</p>
                      </div>
                      <span className="text-sm font-bold text-orange-600">{GHS(p.selling_price || p.sellingPrice || p.price)}</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Barcode */}
          <div className="flex gap-2">
            <input
              value={barcodeInput}
              onChange={e => setBarcodeInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && lookupBarcode()}
              placeholder="Scan barcode & press Enter..."
              className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
            <button onClick={lookupBarcode} className="px-4 py-2 bg-orange-500 text-white text-sm font-semibold rounded-lg hover:bg-orange-600 transition-colors">Lookup</button>
          </div>
        </div>

        {/* Cart */}
        <div className="flex-1 bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col">
          <div className="overflow-x-auto overflow-y-auto flex-1 scrollbar-thin">
            <table className="w-full text-sm min-w-[500px]">
              <thead className="sticky top-0">
                <tr className="bg-orange-500">
                  <th className="text-left text-xs font-semibold text-white uppercase px-3 py-2.5 w-8">#</th>
                  <th className="text-left text-xs font-semibold text-white uppercase px-3 py-2.5">Product</th>
                  <th className="text-center text-xs font-semibold text-white uppercase px-3 py-2.5 w-28">Qty</th>
                  <th className="text-right text-xs font-semibold text-white uppercase px-3 py-2.5 w-28">Price</th>
                  <th className="text-right text-xs font-semibold text-white uppercase px-3 py-2.5 w-24">Total</th>
                  <th className="px-2 py-2.5 w-8"></th>
                </tr>
              </thead>
              <tbody>
                {cart.length === 0 ? (
                  <tr><td colSpan={6} className="text-center py-16 text-gray-400">
                    <div className="flex flex-col items-center gap-2"><span className="text-4xl">🛒</span><p>Cart is empty. Search or scan to add products.</p></div>
                  </td></tr>
                ) : cart.map((item, i) => (
                  <tr key={item._id} className={`border-b border-gray-100 hover:bg-orange-50 transition-colors ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'}`}>
                    <td className="px-3 py-2.5 text-gray-500 text-xs">{i + 1}</td>
                    <td className="px-3 py-2.5"><p className="font-medium text-gray-900">{item.name}</p></td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center justify-center gap-1.5">
                        <button onClick={() => updateQty(item._id, -1)} className="w-6 h-6 rounded-md bg-gray-100 hover:bg-orange-100 text-gray-600 flex items-center justify-center font-bold text-sm transition-colors">−</button>
                        <span className="w-8 text-center font-semibold text-gray-900">{item.qty}</span>
                        <button onClick={() => updateQty(item._id, 1)} className="w-6 h-6 rounded-md bg-gray-100 hover:bg-orange-100 text-gray-600 flex items-center justify-center font-bold text-sm transition-colors">+</button>
                      </div>
                    </td>
                    <td className="px-3 py-2.5">
                      <input type="number" value={item.price} onChange={e => updatePrice(item._id, e.target.value)}
                        className="w-24 text-right text-sm border border-gray-200 rounded-md px-2 py-1 focus:outline-none focus:ring-1 focus:ring-orange-500 ml-auto block" min="0" />
                    </td>
                    <td className="px-3 py-2.5 text-right font-semibold text-orange-600">{GHS(item.price * item.qty)}</td>
                    <td className="px-2 py-2.5">
                      <button onClick={() => removeItem(item._id)} className="text-red-400 hover:text-red-600 transition-colors">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {cart.length > 0 && (
            <div className="border-t border-gray-200 px-4 py-3 bg-gray-50">
              <div className="flex items-center justify-between text-sm mb-1">
                <span className="text-gray-500">Subtotal</span>
                <span className="font-semibold">{GHS(subtotal)}</span>
              </div>
              <div className="flex items-center justify-between text-sm mb-1">
                <div className="flex items-center gap-2">
                  <span className="text-gray-500">Discount</span>
                  <div className="flex items-center gap-1">
                    <input type="number" value={discount} onChange={e => setDiscount(Math.min(100, Math.max(0, parseFloat(e.target.value) || 0)))}
                      className="w-14 text-center text-xs border border-gray-300 rounded px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-orange-500" min="0" max="100" />
                    <span className="text-gray-500 text-xs">%</span>
                  </div>
                </div>
                <span className="text-red-500 font-semibold">-{GHS(discountAmt)}</span>
              </div>
              <div className="flex items-center justify-between border-t border-gray-200 pt-2 mt-1">
                <span className="font-bold text-gray-900">TOTAL</span>
                <span className="text-xl font-black text-orange-600">{GHS(total)}</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Right Panel */}
      <div className="w-72 xl:w-80 flex flex-col gap-4 flex-shrink-0">
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 flex flex-col gap-4">
          <h3 className="font-bold text-gray-900">Customer Info</h3>
          <Input label="Customer Name" value={customer.name} onChange={e => setCustomer({ ...customer, name: e.target.value })} placeholder="Optional" />
          <Input label="Phone Number" value={customer.phone} onChange={e => setCustomer({ ...customer, phone: e.target.value })} placeholder="Optional" />

          <div className="border-t border-gray-100 pt-3">
            <h3 className="font-bold text-gray-900 mb-3">Payment</h3>
            <Select label="Payment Method" value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)}>
              <option value="Cash">Cash</option>
              <option value="Card">Card</option>
              <option value="Mobile Money">Mobile Money</option>
            </Select>
          </div>

          <Input label="Amount Received" type="number" value={amountReceived} onChange={e => setAmountReceived(e.target.value)} placeholder="0.00" min="0" />

          {parseFloat(amountReceived || 0) > 0 && (
            <div className={`rounded-lg p-3 ${change >= 0 ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-gray-700">{change >= 0 ? 'Change' : 'Shortfall'}</span>
                <span className={`font-bold text-lg ${change >= 0 ? 'text-green-600' : 'text-red-600'}`}>{GHS(Math.abs(change))}</span>
              </div>
            </div>
          )}

          <div className="bg-orange-50 rounded-lg p-3 text-center">
            <p className="text-xs text-gray-500 mb-1">Total Amount Due</p>
            <p className="text-2xl font-black text-orange-600">{GHS(total)}</p>
          </div>

          <div className="flex flex-col gap-2 pt-1">
            <Button variant="primary" size="lg" loading={loading} onClick={handleCompleteSale} disabled={cart.length === 0} className="w-full justify-center">
              ✓ Complete Sale
            </Button>
            <Button variant="secondary" size="md" onClick={() => {
              if (cart.length === 0) { toast.error('Cart is empty'); return; }
              setShortPayData({ amountPaid: '', dueDate: '', customerName: customer.name, customerPhone: customer.phone });
              setShortPayModal(true);
            }} disabled={cart.length === 0 || loading} className="w-full justify-center">
              ⚡ Short Payment
            </Button>
            <button onClick={() => { setCart([]); setDiscount(0); setAmountReceived(''); setCustomer({ name: '', phone: '' }); }}
              className="w-full text-sm text-gray-500 hover:text-red-500 transition-colors py-1">
              Clear Cart
            </button>
          </div>
        </div>
      </div>

      {/* Short Payment Modal */}
      <Modal open={shortPayModal} onClose={() => setShortPayModal(false)} title="Short Payment" size="md"
        footer={<><Button variant="ghost" onClick={() => setShortPayModal(false)}>Cancel</Button><Button variant="primary" loading={loading} onClick={handleShortPayment}>Record Sale & Debt</Button></>}>
        <div className="space-y-4">
          <div className="bg-orange-50 rounded-lg p-4">
            <div className="flex justify-between"><span className="text-sm text-gray-600">Total Amount</span><span className="font-bold text-gray-900">{GHS(total)}</span></div>
          </div>
          <Input label="Customer Name *" value={shortPayData.customerName} onChange={e => setShortPayData({ ...shortPayData, customerName: e.target.value })} placeholder="Required for debt tracking" required />
          <Input label="Customer Phone" value={shortPayData.customerPhone} onChange={e => setShortPayData({ ...shortPayData, customerPhone: e.target.value })} placeholder="For follow-up" />
          <Input label="Amount Paid Now" type="number" value={shortPayData.amountPaid} onChange={e => setShortPayData({ ...shortPayData, amountPaid: e.target.value })} placeholder="0.00" min="0" />
          <Input label="Payment Due Date" type="date" value={shortPayData.dueDate} onChange={e => setShortPayData({ ...shortPayData, dueDate: e.target.value })} />
          {shortPayData.amountPaid && (
            <div className="bg-red-50 rounded-lg p-3">
              <div className="flex justify-between"><span className="text-sm text-gray-600">Outstanding Debt</span><span className="font-bold text-red-600">{GHS(total - parseFloat(shortPayData.amountPaid || 0))}</span></div>
            </div>
          )}
        </div>
      </Modal>

      {/* Receipt Modal */}
      <Modal open={receiptModal} onClose={() => { setReceiptModal(false); setLastSale(null); }} title="Sale Receipt" size="md"
        footer={<><Button variant="ghost" onClick={() => { setReceiptModal(false); setLastSale(null); }}>Close</Button><Button variant="secondary" onClick={window.print}>🖨️ Print</Button></>}>
        {lastSale && (
          <div className="font-mono text-sm">
            <div className="text-center mb-4">
              <h3 className="text-lg font-black text-orange-600">DAN & DOR SOLAR CO. LTD</h3>
              <p className="text-xs text-gray-500">ITTEK SOLUTION POS System</p>
              <div className="border-t border-dashed border-gray-300 my-3" />
              <div className="text-left text-xs space-y-1">
                <div className="flex justify-between"><span>Invoice:</span><span className="font-bold">{lastSale.invoiceNo || lastSale._id || 'INV-' + Date.now()}</span></div>
                <div className="flex justify-between"><span>Date:</span><span>{new Date(lastSale.createdAt || Date.now()).toLocaleString()}</span></div>
                {lastSale.customer?.name && <div className="flex justify-between"><span>Customer:</span><span>{lastSale.customer.name}</span></div>}
              </div>
              <div className="border-t border-dashed border-gray-300 my-3" />
            </div>
            <table className="w-full text-xs mb-3">
              <thead><tr className="border-b border-gray-200"><th className="text-left pb-1">Item</th><th className="text-center pb-1">Qty</th><th className="text-right pb-1">Price</th><th className="text-right pb-1">Total</th></tr></thead>
              <tbody>
                {(lastSale.items || []).map((item, i) => (
                  <tr key={i} className="border-b border-gray-100">
                    <td className="py-1">{item.name}</td>
                    <td className="text-center py-1">{item.qty}</td>
                    <td className="text-right py-1">{GHS(item.price)}</td>
                    <td className="text-right py-1">{GHS(item.qty * item.price)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="border-t border-dashed border-gray-300 pt-2 space-y-1 text-xs">
              <div className="flex justify-between"><span>Subtotal:</span><span>{GHS(lastSale.subtotal)}</span></div>
              {lastSale.discount > 0 && <div className="flex justify-between text-red-500"><span>Discount ({lastSale.discount}%):</span><span>-{GHS(lastSale.discountAmount)}</span></div>}
              <div className="flex justify-between font-black text-base mt-2"><span>TOTAL:</span><span className="text-orange-600">{GHS(lastSale.total)}</span></div>
              <div className="flex justify-between"><span>Paid ({lastSale.paymentMethod}):</span><span>{GHS(lastSale.amountReceived)}</span></div>
              {lastSale.isShortPayment
                ? <div className="flex justify-between text-red-500"><span>Outstanding:</span><span>{GHS(lastSale.debtAmount)}</span></div>
                : <div className="flex justify-between text-green-600"><span>Change:</span><span>{GHS(lastSale.change)}</span></div>
              }
            </div>
            <div className="text-center mt-4 text-xs text-gray-400"><p>Thank you for your business!</p><p>Powered by ITTEK SOLUTION</p></div>
          </div>
        )}
      </Modal>
    </div>
  );
}
