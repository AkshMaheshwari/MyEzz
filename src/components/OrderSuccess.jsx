import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { CheckCircle, Home, Printer, MapPin, Phone, Mail, User, ShoppingBag, Calendar, Clock } from "lucide-react";
import { 
    trackOrder, 
    formatOrderStatus, 
    initializeRealtimeConnection, 
    subscribeToOrder,
    disconnectRealtime 
} from "../api/unifiedOrderService";

const OrderSuccess = () => {
  const { state } = useLocation();
  const navigate = useNavigate();

  const orderId = state?.orderId;
  const customerInfo = state?.customerInfo;
  const cartItems = state?.cart;
  const orderDetails = state?.orderDetails;

  const [order, setOrder] = useState(orderDetails || null);
  const [tracking, setTracking] = useState(null);
  const [loading, setLoading] = useState(!orderDetails);
  const [error, setError] = useState(null);
  const [statusUpdate, setStatusUpdate] = useState(null);

  useEffect(() => {
    const fetchOrderTracking = async () => {
      if (!orderId) {
        setLoading(false);
        return;
      }
      try {
        const trackingData = await trackOrder(orderId);
        setOrder(trackingData.data?.order || orderDetails);
        setTracking(trackingData.data);
      } catch (err) {
        if (orderDetails) {
          setOrder(orderDetails);
        } else {
          setError("Unable to load your order from the server.");
        }
        console.error("Error fetching order:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchOrderTracking();

    if (orderId && customerInfo?.userId) {
      initializeRealtimeConnection(customerInfo.userId, {
        onOrderAccepted: (data) => {
          if (data.orderId === orderId) {
            setStatusUpdate({
              type: 'success',
              message: data.message || 'Restaurant accepted your order!'
            });
            fetchOrderTracking();
          }
        },
        onOrderRejected: (data) => {
          if (data.orderId === orderId) {
            setStatusUpdate({
              type: 'error',
              message: data.message || 'Restaurant could not accept your order.'
            });
            fetchOrderTracking();
          }
        },
        onStatusUpdate: (data) => {
          if (data.orderId === orderId) {
            setStatusUpdate({
              type: 'info',
              message: data.message || `Order status: ${data.status}`
            });
            fetchOrderTracking();
          }
        }
      });

      subscribeToOrder(orderId);
    }

    return () => disconnectRealtime();
  }, [orderId, customerInfo?.userId, orderDetails]);

  if (!orderId || !customerInfo || !cartItems) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 dark:bg-gray-900 p-4">
        <div className="text-center space-y-4">
          <div className="bg-red-100 dark:bg-red-900/20 p-4 rounded-full inline-flex">
            <ShoppingBag className="w-8 h-8 text-red-500" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">No order found</h2>
          <button
            onClick={() => navigate("/")}
            className="px-6 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors"
          >
            Go Home
          </button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 dark:bg-gray-900 p-4">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-orange-500 mx-auto"></div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">Loading your order...</h2>
        </div>
      </div>
    );
  }

  if (error && !order) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 dark:bg-gray-900 p-4">
        <div className="text-center space-y-4">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">There was a problem loading your order</h2>
          <p className="text-gray-500 dark:text-gray-400">{error || "Order not found."}</p>
          <button
            onClick={() => navigate("/")}
            className="px-6 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors"
          >
            Go Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-12 px-4 sm:px-6 lg:px-8 flex items-center justify-center">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-2xl bg-white dark:bg-gray-800 rounded-3xl shadow-2xl overflow-hidden border border-gray-100 dark:border-gray-700"
      >
        {/* Success Header */}
        <div className="bg-gradient-to-br from-orange-500 to-orange-600 p-8 text-center text-white relative overflow-hidden">
          <div className="absolute top-0 right-0 -mr-8 -mt-8 w-32 h-32 rounded-full bg-white/10 blur-2xl"></div>
          <div className="absolute bottom-0 left-0 -ml-8 -mb-8 w-24 h-24 rounded-full bg-white/10 blur-2xl"></div>

          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 200, damping: 15, delay: 0.2 }}
            className="w-20 h-20 bg-white rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg"
          >
            <CheckCircle className="w-10 h-10 text-orange-500" />
          </motion.div>

          <h1 className="text-3xl font-bold mb-2">Order Placed Successfully!</h1>
          <p className="text-orange-100 opacity-90">
            Thank you for choosing MyEzz. Your tasty moments are on the way!
          </p>
        </div>

        <div className="p-6 sm:p-8 space-y-8">
          {/* Order Details Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className="bg-orange-50 dark:bg-orange-900/10 p-4 rounded-2xl border border-orange-100 dark:border-orange-800/30">
              <p className="text-xs text-orange-600 dark:text-orange-400 font-semibold uppercase tracking-wider mb-1">Order ID</p>
              <p className="text-lg font-bold text-gray-900 dark:text-white">#{order.orderId || order._id}</p>
            </div>
            <div className="bg-blue-50 dark:bg-blue-900/10 p-4 rounded-2xl border border-blue-100 dark:border-blue-800/30">
              <p className="text-xs text-blue-600 dark:text-blue-400 font-semibold uppercase tracking-wider mb-1">Date & Time</p>
              <div className="flex items-center text-gray-900 dark:text-white font-medium">
                <Calendar className="w-4 h-4 mr-2 opacity-70" />
                {order.createdAt 
                  ? `${new Date(order.createdAt).toLocaleDateString()} • ${new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                  : `${new Date().toLocaleDateString()} • ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                }
              </div>
            </div>
          </div>

          {/* Customer Info */}
          <div className="space-y-4">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center">
              <User className="w-5 h-5 mr-2 text-orange-500" />
              Customer Details
            </h3>
            <div className="bg-gray-50 dark:bg-gray-700/30 rounded-2xl p-5 border border-gray-100 dark:border-gray-700 space-y-3">
              <div className="flex items-start">
                <User className="w-4 h-4 mt-1 mr-3 text-gray-400" />
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Name</p>
                  <p className="font-medium text-gray-900 dark:text-white">{customerInfo.fullName || customerInfo.name}</p>
                </div>
              </div>
              <div className="flex items-start">
                <Phone className="w-4 h-4 mt-1 mr-3 text-gray-400" />
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Phone</p>
                  <p className="font-medium text-gray-900 dark:text-white">{customerInfo.phoneNumber || customerInfo.phone}</p>
                </div>
              </div>
              <div className="flex items-start">
                <Mail className="w-4 h-4 mt-1 mr-3 text-gray-400" />
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Email</p>
                  <p className="font-medium text-gray-900 dark:text-white">{customerInfo.emailId || customerInfo.email}</p>
                </div>
              </div>
              <div className="flex items-start">
                <MapPin className="w-4 h-4 mt-1 mr-3 text-gray-400" />
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Delivery Address</p>
                  <p className="font-medium text-gray-900 dark:text-white">{customerInfo.fullAddress || customerInfo.address}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Order Items */}
          <div className="space-y-4">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center">
              <ShoppingBag className="w-5 h-5 mr-2 text-orange-500" />
              Order Summary
            </h3>
            <div className="border border-gray-200 dark:border-gray-700 rounded-2xl overflow-hidden">
              <div className="bg-gray-50 dark:bg-gray-700/50 px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                <div className="flex-1">Item</div>
                <div className="w-16 text-center">Qty</div>
                <div className="w-20 text-right">Price</div>
              </div>
              <div className="divide-y divide-gray-100 dark:divide-gray-700">
                {cartItems.map((item, index) => (
                  <div key={index} className="px-4 py-3 flex items-center text-sm">
                    <div className="flex-1 font-medium text-gray-900 dark:text-white">
                      {item.name}
                      {item.portion && <span className="text-gray-500 dark:text-gray-400 font-normal ml-1">({item.portion})</span>}
                    </div>
                    <div className="w-16 text-center text-gray-600 dark:text-gray-300">{item.quantity}</div>
                    <div className="w-20 text-right font-medium text-gray-900 dark:text-white">₹{item.price * item.quantity}</div>
                  </div>
                ))}
              </div>
              <div className="bg-gray-50 dark:bg-gray-700/50 px-4 py-4 border-t border-gray-200 dark:border-gray-700">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-gray-900 dark:text-white">Total Amount</span>
                  <span className="text-xl font-bold text-orange-600 dark:text-orange-400">₹{order.total || order.price}</span>
                </div>
                <div className="flex justify-between items-center mt-2 text-sm">
                  <span className="text-gray-500 dark:text-gray-400">Payment Method</span>
                  <span className="font-medium text-gray-900 dark:text-white bg-white dark:bg-gray-600 px-2 py-1 rounded border border-gray-200 dark:border-gray-500 uppercase text-xs tracking-wide">
                    {order.paymentMethod === "cash_on_delivery" ? "Cash on Delivery" : "Online"}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Status Update Toast */}
          {statusUpdate && (
            <div className={`p-4 rounded-xl ${
              statusUpdate.type === 'success' ? 'bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-400' :
              statusUpdate.type === 'error' ? 'bg-red-100 dark:bg-red-900/20 text-red-800 dark:text-red-400' :
              'bg-blue-100 dark:bg-blue-900/20 text-blue-800 dark:text-blue-400'
            }`}>
              <p className="font-medium">{statusUpdate.message}</p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 pt-4">
            <button
              onClick={() => navigate("/")}
              className="flex-1 flex items-center justify-center px-6 py-3 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-white font-bold rounded-xl transition-all duration-300 hover:bg-gray-200 dark:hover:bg-gray-600"
            >
              <Home className="w-5 h-5 mr-2" />
              Home
            </button>
            <button
              onClick={() => navigate(`/track/${order.orderId || order._id}`)}
              className="flex-[2] flex items-center justify-center px-6 py-3 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-xl transition-all duration-300 shadow-lg shadow-orange-200/50 dark:shadow-orange-900/30 transform hover:-translate-y-1"
            >
              <MapPin className="w-5 h-5 mr-2" />
              Track Your Order
            </button>
            <button
              onClick={() => window.print()}
              className="flex-1 flex items-center justify-center px-6 py-3 bg-white dark:bg-gray-700 text-gray-700 dark:text-white font-bold rounded-xl border-2 border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600 transition-all duration-300"
            >
              <Printer className="w-5 h-5 mr-2" />
              Print Receipt
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

export default OrderSuccess;