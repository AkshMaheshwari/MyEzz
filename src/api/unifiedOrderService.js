/**
 * MyEzz Unified Order Service
 * Handles order placement and tracking for User App
 * Connects to the unified order system via Restaurant Backend
 */

import axios from 'axios';
import { io } from 'socket.io-client';

// API Base URL - Points to Restaurant Backend which hosts the unified API
const UNIFIED_API_URL = import.meta.env.VITE_UNIFIED_API_URL || 'http://localhost:3001';
const WEBSOCKET_URL = import.meta.env.VITE_WEBSOCKET_URL || 'http://localhost:3001';

// Axios instance for unified API
const unifiedApiClient = axios.create({
    baseURL: `${UNIFIED_API_URL}/api/unified`,
    headers: {
        'Content-Type': 'application/json'
    },
    timeout: 15000
});

// Socket.io client for real-time updates
let socket = null;

/**
 * Initialize WebSocket connection for real-time updates
 * @param {string} customerId - Customer ID for room subscription
 * @param {object} callbacks - Event callbacks
 */
export const initializeRealtimeConnection = (customerId, callbacks = {}) => {
    if (socket?.connected) {
        return socket;
    }

    socket = io(WEBSOCKET_URL, {
        transports: ['websocket', 'polling'],
        autoConnect: true,
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000
    });

    socket.on('connect', () => {
        console.log('🔌 Connected to MyEzz real-time server');
        
        // Authenticate and join customer room
        socket.emit('authenticate', {
            type: 'customer',
            id: customerId
        });
        socket.emit('customer:join', customerId);

        if (callbacks.onConnect) {
            callbacks.onConnect();
        }
    });

    socket.on('disconnect', () => {
        console.log('❌ Disconnected from real-time server');
        if (callbacks.onDisconnect) {
            callbacks.onDisconnect();
        }
    });

    socket.on('authenticated', (data) => {
        console.log('✅ Authenticated with real-time server', data);
    });

    // Order status updates
    socket.on('order_accepted', (data) => {
        console.log('📦 Order accepted:', data);
        if (callbacks.onOrderAccepted) {
            callbacks.onOrderAccepted(data);
        }
    });

    socket.on('order_rejected', (data) => {
        console.log('❌ Order rejected:', data);
        if (callbacks.onOrderRejected) {
            callbacks.onOrderRejected(data);
        }
    });

    socket.on('order_status_updated', (data) => {
        console.log('📋 Order status updated:', data);
        if (callbacks.onStatusUpdate) {
            callbacks.onStatusUpdate(data);
        }
    });

    socket.on('order_updated', (data) => {
        console.log('📦 Order updated:', data);
        if (callbacks.onOrderUpdate) {
            callbacks.onOrderUpdate(data);
        }
    });

    // Rider location updates for live tracking
    socket.on('rider_location', (data) => {
        console.log('🛵 Rider location update:', data);
        if (callbacks.onRiderLocation) {
            callbacks.onRiderLocation(data);
        }
    });

    return socket;
};

/**
 * Subscribe to order tracking
 * @param {string} orderId - Order ID to track
 */
export const subscribeToOrder = (orderId) => {
    if (socket?.connected) {
        socket.emit('order:subscribe', orderId);
        socket.emit('customer:track_order', orderId);
        console.log(`👁️ Subscribed to order tracking: ${orderId}`);
    }
};

/**
 * Unsubscribe from order tracking
 * @param {string} orderId - Order ID to stop tracking
 */
export const unsubscribeFromOrder = (orderId) => {
    if (socket?.connected) {
        socket.emit('order:unsubscribe', orderId);
        console.log(`👁️ Unsubscribed from order: ${orderId}`);
    }
};

/**
 * Disconnect from real-time server
 */
export const disconnectRealtime = () => {
    if (socket) {
        socket.disconnect();
        socket = null;
    }
};

/**
 * Place a new order through the unified system
 * @param {object} orderData - Order details
 * @returns {Promise<object>} Created order
 */
export const placeOrder = async (orderData) => {
    const {
        customerInfo,
        cart,
        subtotal,
        deliveryFee,
        platformFee,
        total,
        paymentMethod,
        paymentStatus
    } = orderData;

    // Group items by restaurant
    const ordersByRestaurant = groupItemsByRestaurant(cart);

    // For single restaurant order
    if (Object.keys(ordersByRestaurant).length === 1) {
        const restaurantId = Object.keys(ordersByRestaurant)[0];
        const items = ordersByRestaurant[restaurantId];
        const restaurantName = items[0]?.vendor || items[0]?.restaurantName || 'Restaurant';

        const payload = {
            customerId: customerInfo.userId || null,
            customerName: customerInfo.fullName || customerInfo.name,
            customerPhone: customerInfo.phoneNumber || customerInfo.phone,
            customerEmail: customerInfo.emailId || customerInfo.email,
            deliveryAddress: customerInfo.fullAddress || customerInfo.address,
            deliveryLocation: {
                type: 'Point',
                coordinates: [
                    customerInfo.longitude || 0,
                    customerInfo.latitude || 0
                ]
            },
            restaurantId: parseInt(restaurantId) || 1,
            restaurantName: restaurantName,
            items: items.map(item => ({
                name: item.name,
                quantity: item.quantity,
                price: item.price,
                isVeg: item.isVeg !== false,
                jain: item.jain || false,
                portion: item.portion || null,
                notes: item.notes || null
            })),
            subtotal,
            deliveryFee,
            platformFee,
            total,
            paymentMethod: paymentMethod === 'cod' ? 'cash_on_delivery' : 'online',
            paymentStatus: paymentStatus || 'pending',
            notes: customerInfo.notes || null
        };

        const response = await unifiedApiClient.post('/orders', payload);
        return response.data;
    }

    // For multi-restaurant order - create separate orders
    const orders = [];
    for (const [restaurantId, items] of Object.entries(ordersByRestaurant)) {
        const restaurantName = items[0]?.vendor || items[0]?.restaurantName || 'Restaurant';
        const restaurantSubtotal = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        const restaurantDeliveryFee = 30; // Per restaurant
        const restaurantTotal = restaurantSubtotal + restaurantDeliveryFee + platformFee;

        const payload = {
            customerId: customerInfo.userId || null,
            customerName: customerInfo.fullName || customerInfo.name,
            customerPhone: customerInfo.phoneNumber || customerInfo.phone,
            customerEmail: customerInfo.emailId || customerInfo.email,
            deliveryAddress: customerInfo.fullAddress || customerInfo.address,
            deliveryLocation: {
                type: 'Point',
                coordinates: [
                    customerInfo.longitude || 0,
                    customerInfo.latitude || 0
                ]
            },
            restaurantId: parseInt(restaurantId) || 1,
            restaurantName: restaurantName,
            items: items.map(item => ({
                name: item.name,
                quantity: item.quantity,
                price: item.price,
                isVeg: item.isVeg !== false,
                jain: item.jain || false,
                portion: item.portion || null
            })),
            subtotal: restaurantSubtotal,
            deliveryFee: restaurantDeliveryFee,
            platformFee,
            total: restaurantTotal,
            paymentMethod: paymentMethod === 'cod' ? 'cash_on_delivery' : 'online',
            paymentStatus: paymentStatus || 'pending'
        };

        const response = await unifiedApiClient.post('/orders', payload);
        orders.push(response.data);
    }

    return {
        success: true,
        data: orders,
        message: `${orders.length} orders placed successfully`
    };
};

/**
 * Get order details by ID
 * @param {string} orderId - Order ID
 * @returns {Promise<object>} Order details
 */
export const getOrder = async (orderId) => {
    const response = await unifiedApiClient.get(`/orders/${orderId}`);
    return response.data;
};

/**
 * Track order status
 * @param {string} orderId - Order ID
 * @returns {Promise<object>} Order tracking info
 */
export const trackOrder = async (orderId) => {
    const response = await unifiedApiClient.get(`/orders/${orderId}/track`);
    return response.data;
};

/**
 * Get customer's order history
 * @param {string} customerId - Customer ID
 * @param {number} limit - Number of orders to fetch
 * @returns {Promise<object>} Orders list
 */
export const getCustomerOrders = async (customerId, limit = 20) => {
    const response = await unifiedApiClient.get(`/customer/${customerId}/orders`, {
        params: { limit }
    });
    return response.data;
};

/**
 * Cancel an order
 * @param {string} orderId - Order ID
 * @param {string} reason - Cancellation reason
 * @returns {Promise<object>} Updated order
 */
export const cancelOrder = async (orderId, reason = 'Customer requested cancellation') => {
    const response = await unifiedApiClient.post(`/orders/${orderId}/status`, {
        status: 'cancelled',
        cancellation_reason: reason
    });
    return response.data;
};

/**
 * Group cart items by restaurant
 * @param {array} cart - Cart items
 * @returns {object} Items grouped by restaurant ID
 */
const groupItemsByRestaurant = (cart) => {
    return cart.reduce((acc, item) => {
        const restaurantId = item.restaurantId || item.vendorId || '1';
        if (!acc[restaurantId]) {
            acc[restaurantId] = [];
        }
        acc[restaurantId].push(item);
        return acc;
    }, {});
};

/**
 * Format order status for display
 * @param {string} status - Order status
 * @returns {object} Formatted status with label and color
 */
export const formatOrderStatus = (status) => {
    const statusMap = {
        'pending_restaurant': { label: 'Waiting for Restaurant', color: 'yellow', icon: '⏳' },
        'preparing': { label: 'Being Prepared', color: 'blue', icon: '👨‍🍳' },
        'ready_for_pickup': { label: 'Ready for Pickup', color: 'purple', icon: '📦' },
        'rider_assigned': { label: 'Rider Assigned', color: 'indigo', icon: '🛵' },
        'picked_up': { label: 'Picked Up', color: 'cyan', icon: '✅' },
        'out_for_delivery': { label: 'Out for Delivery', color: 'orange', icon: '🚀' },
        'delivered': { label: 'Delivered', color: 'green', icon: '🎉' },
        'rejected': { label: 'Rejected', color: 'red', icon: '❌' },
        'cancelled': { label: 'Cancelled', color: 'gray', icon: '🚫' }
    };

    return statusMap[status] || { label: status, color: 'gray', icon: '❓' };
};

export default {
    placeOrder,
    getOrder,
    trackOrder,
    getCustomerOrders,
    cancelOrder,
    formatOrderStatus,
    initializeRealtimeConnection,
    subscribeToOrder,
    unsubscribeFromOrder,
    disconnectRealtime
};
