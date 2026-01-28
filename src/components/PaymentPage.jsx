import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { CreditCard, Wallet, CheckCircle2, ShieldCheck, Lock, Check } from "lucide-react"; // icons
// Import unified order service (replaces direct rider integration)
import { placeOrder as placeUnifiedOrder } from "../api/unifiedOrderService";

const FoodBackground = () => {
  const [particles, setParticles] = useState([]);

  useEffect(() => {
    const icons = ["🍔", "🍕", "🍟", "🌭", "🍿", "🍩", "🍪", "🥤", "🍗", "🥗"];
    const newParticles = Array.from({ length: 25 }).map((_, i) => ({
      id: i,
      icon: icons[Math.floor(Math.random() * icons.length)],
      top: `${Math.random() * 100}%`,
      left: `${Math.random() * 100}%`,
      delay: `${Math.random() * 5}s`,
      duration: `${15 + Math.random() * 10}s`,
      size: `${24 + Math.random() * 24}px`,
      rotation: Math.random() * 360
    }));
    setParticles(newParticles);
  }, []);

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none select-none z-0">
      <style>
        {`
          @keyframes float {
            0% { transform: translateY(0px) rotate(0deg); }
            50% { transform: translateY(-20px) rotate(10deg); }
            100% { transform: translateY(0px) rotate(0deg); }
          }
          .animate-float {
            animation: float ease-in-out infinite;
          }
        `}
      </style>
      {particles.map((p) => (
        <div
          key={p.id}
          className="absolute animate-float opacity-40 dark:opacity-10 hover:opacity-40 transition-opacity duration-300"
          style={{
            top: p.top,
            left: p.left,
            fontSize: p.size,
            animationDelay: p.delay,
            animationDuration: p.duration,
            transform: `rotate(${p.rotation}deg)`
          }}
        >
          {p.icon}
        </div>
      ))}
    </div>
  );
};

const SuccessModal = () => (
  <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fade-in">
    <style>
      {`
        @keyframes bounce-in {
          0% { transform: scale(0.3); opacity: 0; }
          50% { transform: scale(1.05); opacity: 1; }
          70% { transform: scale(0.9); }
          100% { transform: scale(1); }
        }
        .animate-bounce-in {
          animation: bounce-in 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
        }
        @keyframes check-stroke {
          from { stroke-dashoffset: 100; }
          to { stroke-dashoffset: 0; }
        }
        .animate-check-stroke {
          stroke-dasharray: 100;
          stroke-dashoffset: 100;
          animation: check-stroke 0.6s ease-in-out forwards;
        }
      `}
    </style>
    <div className="bg-white dark:bg-gray-800 p-8 rounded-3xl shadow-2xl flex flex-col items-center transform scale-100 animate-bounce-in">
      <div className="w-20 h-20 bg-green-500 rounded-full flex items-center justify-center mb-4 shadow-lg shadow-green-500/30">
        <Check className="w-10 h-10 text-white animate-check-stroke" strokeWidth={3} />
      </div>
      <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Order Placed Successfully!</h3>
      <p className="text-gray-500 dark:text-gray-400">Redirecting to order confirmation...</p>
    </div>
  </div>
);

function PaymentPage() {
  const [method, setMethod] = useState("");
  const [loading, setLoading] = useState(false); // ✅ Fix: Declare the loading state
  const [showSuccess, setShowSuccess] = useState(false);
  const navigate = useNavigate();
  const { state } = useLocation();
  const { customerInfo, cart } = state || {};

  const subtotal = cart?.reduce((sum, item) => sum + item.price * item.quantity, 0) || 0;

  // Calculate number of unique vendors for delivery fee
  const uniqueVendors = new Set(cart?.map(item => item.vendor || item.restaurantName || 'Unknown Restaurant') || []);
  const deliveryFee = uniqueVendors.size * 30;

  const platformFee = 8;
  const total = subtotal + deliveryFee + platformFee;

  const placeOrder = async (paymentStatus = 'pending') => {
    setLoading(true);
    try {
      const mappedCustomerInfo = {
        fullName: customerInfo.name || customerInfo.fullName,
        phoneNumber: customerInfo.phone || customerInfo.phoneNumber,
        emailId: customerInfo.email || customerInfo.emailId,
        fullAddress: customerInfo.address || customerInfo.fullAddress,
        userId: customerInfo.userId || null,
        latitude: customerInfo.latitude || 0,
        longitude: customerInfo.longitude || 0,
        notes: customerInfo.notes || ''
      };

      const orderPayload = {
        customerInfo: mappedCustomerInfo,
        cart,
        subtotal,
        deliveryFee,
        platformFee,
        total,
        paymentMethod: method,
        paymentStatus: paymentStatus
      };

      const result = await placeUnifiedOrder(orderPayload);

      if (result.success) {
        const orderData = Array.isArray(result.data) ? result.data[0] : result.data;
        
        setShowSuccess(true);
        setTimeout(() => {
          navigate("/success", {
            state: {
              orderId: orderData.orderId || orderData.order_id,
              customerInfo: mappedCustomerInfo,
              cart,
              orderDetails: orderData
            },
          });
        }, 2000);
      } else {
        throw new Error(result.error || 'Failed to place order');
      }
    } catch (error) {
      console.error("Error placing order:", error);
      alert(error.message || "Failed to place order. Please try again.");
    } finally {
      if (!showSuccess) setLoading(false);
    }
  };

  const handlePay = async () => {
    if (!method) return alert("Select payment method");

    if (method === "cod") {
      await placeOrder('pending');
      return;
    }

    const options = {
      key: "rzp_live_UnqqNKF8XycJ4L",
      amount: total * 100,
      currency: "INR",
      name: "MyEzz",
      description: "Order Payment",
      handler: async (response) => {
        setLoading(true);
        try {
          // Payment successful - place order with paid status
          await placeOrder('paid');
        } catch (error) {
          console.error("Payment handler error:", error);
        } finally {
          setLoading(false);
        }
      },
      prefill: {
        name: customerInfo.fullName,
        email: customerInfo.emailId,
        contact: customerInfo.phoneNumber,
      },
      theme: { color: "#db5a19ff" },
    };

    const rzp = new window.Razorpay(options);
    rzp.open();
  };

  if (!customerInfo || !cart || cart.length === 0) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#0B1120] p-4">
        <div className="text-center space-y-4 animate-fade-in">
          <div className="bg-orange-900/20 p-6 rounded-full inline-flex mb-2">
            <Wallet className="w-12 h-12 text-orange-500" />
          </div>
          <h2 className="text-2xl font-bold text-white">Your cart is empty</h2>
          <p className="text-[#94A3B8] max-w-md mx-auto">
            Looks like you haven't added anything to your cart yet. Go back and add some delicious food!
          </p>
          <button
            onClick={() => navigate("/")}
            className="mt-4 px-8 py-3 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-xl transition-all duration-300 shadow-lg shadow-orange-900/30 transform hover:-translate-y-1"
          >
            Browse Menu
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0B1120] py-8 px-4 sm:px-6 lg:px-8 flex items-center justify-center transition-colors duration-300 relative overflow-hidden">
      <FoodBackground />
      {showSuccess && <SuccessModal />}
      <div className="w-full max-w-5xl grid grid-cols-1 lg:grid-cols-2 gap-8 relative z-10">

        {/* Payment Section */}
        <div className="bg-[#1F2937] rounded-3xl shadow-xl overflow-hidden border border-[#374151] h-fit">
          {/* Header Section */}
          <div className="bg-gradient-to-br from-orange-500 to-orange-600 p-8 text-white relative overflow-hidden">
            <div className="absolute top-0 right-0 -mr-8 -mt-8 w-32 h-32 rounded-full bg-white/10 blur-2xl"></div>
            <div className="absolute bottom-0 left-0 -ml-8 -mb-8 w-24 h-24 rounded-full bg-white/10 blur-2xl"></div>

            <div className="relative z-10">
              <h2 className="text-2xl font-bold tracking-tight">Payment Method</h2>
              <p className="text-orange-100 text-sm mt-1 opacity-90">Select how you'd like to pay</p>
            </div>
          </div>

          {/* Body */}
          <div className="p-6 sm:p-8 space-y-6">
            <div className="space-y-4">
              {/* Card/UPI Option */}
              <div
                onClick={() => setMethod("card")}
                className={`relative flex items-center p-4 rounded-2xl border-2 cursor-pointer transition-all duration-300 group
                  ${method === "card"
                    ? "border-orange-500 bg-orange-900/20 shadow-lg scale-[1.02]"
                    : "border-[#374151] hover:border-orange-800 hover:bg-[#0B1120]"
                  }`}
              >
                <div className={`p-3.5 rounded-xl mr-4 transition-colors duration-300 ${method === "card" ? "bg-orange-500 text-white shadow-md" : "bg-[#0B1120] text-[#94A3B8]"}`}>
                  <CreditCard size={24} />
                </div>
                <div className="flex-1">
                  <h4 className={`font-bold text-base ${method === "card" ? "text-orange-400" : "text-white"}`}>Pay Online</h4>
                  <p className="text-xs text-[#94A3B8] mt-0.5">UPI, Cards, Netbanking</p>
                </div>
                {method === "card" && (
                  <div className="bg-orange-500 rounded-full p-1">
                    <CheckCircle2 className="text-white" size={16} />
                  </div>
                )}
              </div>

              {/* COD Option */}
              <div
                onClick={() => setMethod("cod")}
                className={`relative flex items-center p-4 rounded-2xl border-2 cursor-pointer transition-all duration-300 group
                  ${method === "cod"
                    ? "border-orange-500 bg-orange-900/20 shadow-lg scale-[1.02]"
                    : "border-[#374151] hover:border-orange-800 hover:bg-[#0B1120]"
                  }`}
              >
                <div className={`p-3.5 rounded-xl mr-4 transition-colors duration-300 ${method === "cod" ? "bg-orange-500 text-white shadow-md" : "bg-[#0B1120] text-[#94A3B8]"}`}>
                  <Wallet size={24} />
                </div>
                <div className="flex-1">
                  <h4 className={`font-bold text-base ${method === "cod" ? "text-orange-400" : "text-white"}`}>Cash on Delivery</h4>
                  <p className="text-xs text-[#94A3B8] mt-0.5">Pay at your doorstep</p>
                </div>
                {method === "cod" && (
                  <div className="bg-orange-500 rounded-full p-1">
                    <CheckCircle2 className="text-white" size={16} />
                  </div>
                )}
              </div>
            </div>

            {/* Security Note */}
            <div className="flex items-center justify-center text-xs text-[#94A3B8] bg-[#0B1120] py-3 px-4 rounded-xl border border-[#374151]">
              <Lock size={14} className="mr-2 text-green-500" />
              <span className="font-medium">Payments are 100% secure and encrypted</span>
            </div>

            {/* Pay Button */}
            <button
              onClick={handlePay}
              disabled={loading}
              className={`w-full py-4 text-lg font-bold rounded-2xl shadow-xl transition-all duration-300 transform active:scale-[0.98]
                ${loading
                  ? "bg-[#374151] text-[#94A3B8] cursor-not-allowed shadow-none"
                  : "bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white shadow-orange-900/30 hover:shadow-orange-800/50"
                }`}
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Processing...
                </span>
              ) : (
                `Pay ₹${total}`
              )}
            </button>
          </div>
        </div>

        {/* Right Column: Order Summary */}
        <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-xl overflow-hidden border border-gray-100 dark:border-gray-700 h-fit">
          <div className="p-6 sm:p-8 bg-gray-50/50 dark:bg-gray-800/50">
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-6">Order Summary</h3>

            <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
              {cart.map((item, index) => {
                const restaurantName = item.vendor || item.restaurantName || 'Unknown Restaurant';
                return (
                  <div key={`${item.id}-${index}`} className="flex justify-between items-start py-3 border-b border-gray-100 dark:border-gray-700 last:border-0">
                    <div className="flex-1">
                      <p className="font-semibold text-gray-800 dark:text-gray-200">{item.name}</p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {item.quantity} x ₹{item.price}
                        {item.portion && ` • ${item.portion}`}
                      </p>
                      <p className="text-xs text-orange-600 dark:text-orange-400 mt-1 flex items-center gap-1">
                        <span>🍽️</span>
                        <span className="font-medium">{restaurantName}</span>
                      </p>
                    </div>
                    <p className="font-medium text-gray-900 dark:text-white">₹{item.price * item.quantity}</p>
                  </div>
                );
              })}
            </div>

            <div className="mt-6 space-y-3 pt-6 border-t border-gray-200 dark:border-gray-700">
              <div className="flex justify-between text-gray-600 dark:text-gray-400">
                <span>Subtotal</span>
                <span>₹{subtotal}</span>
              </div>
              <div className="flex justify-between text-gray-600 dark:text-gray-400">
                <span>Delivery Fee ({uniqueVendors.size} vendor{uniqueVendors.size > 1 ? 's' : ''})</span>
                <span>₹{deliveryFee}</span>
              </div>
              <div className="flex justify-between text-gray-600 dark:text-gray-400">
                <span>Platform Fee</span>
                <span>₹{platformFee}</span>
              </div>
              <div className="flex justify-between text-xl font-bold text-gray-900 dark:text-white pt-4 border-t border-gray-200 dark:border-gray-700">
                <span>Total</span>
                <span className="text-orange-600 dark:text-orange-400">₹{total}</span>
              </div>
            </div>

            {/* Customer Info Preview */}
            <div className="mt-8 pt-6 border-t border-gray-200 dark:border-gray-700">
              <h4 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-4">Delivering To</h4>
              <div className="space-y-3">
                <div className="grid grid-cols-[80px_1fr] gap-2 text-sm">
                  <span className="text-gray-500 dark:text-gray-400">Name:</span>
                  <span className="font-medium text-gray-900 dark:text-white">
                    {customerInfo?.fullName || customerInfo?.name || "Not provided"}
                  </span>
                </div>
                <div className="grid grid-cols-[80px_1fr] gap-2 text-sm">
                  <span className="text-gray-500 dark:text-gray-400">Phone:</span>
                  <span className="font-medium text-gray-900 dark:text-white">
                    {customerInfo?.phoneNumber || customerInfo?.phone || "Not provided"}
                  </span>
                </div>
                <div className="grid grid-cols-[80px_1fr] gap-2 text-sm">
                  <span className="text-gray-500 dark:text-gray-400">Email:</span>
                  <span className="font-medium text-gray-900 dark:text-white">
                    {customerInfo?.emailId || customerInfo?.email || "Not provided"}
                  </span>
                </div>
                <div className="mt-2">
                  <span className="text-xs text-gray-500 dark:text-gray-400 block mb-1">Address:</span>
                  <p className="text-sm font-medium text-gray-900 dark:text-white bg-gray-50 dark:bg-gray-700/50 p-3 rounded-lg border border-gray-100 dark:border-gray-700 leading-relaxed">
                    {customerInfo?.fullAddress || customerInfo?.address || "Address not provided"}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

export default PaymentPage;


