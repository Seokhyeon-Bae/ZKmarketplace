import { ConnectButton } from '@rainbow-me/rainbowkit'
import { useAccount, useContract, useSigner } from 'wagmi'
import { useState, useEffect } from 'react'
import axios from 'axios'

const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || '0x5FbDB2315678afecb367f032d93F642f64180aa3'

export default function Home() {
  const { address, isConnected } = useAccount()
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(false)
  const [newOrder, setNewOrder] = useState({ description: '', amount: '' })

  useEffect(() => {
    if (isConnected) {
      fetchOrders()
    }
  }, [isConnected])

  const fetchOrders = async () => {
    try {
      const response = await axios.get('http://localhost:3001/api/orders')
      setOrders(response.data)
    } catch (error) {
      console.error('Error fetching orders:', error)
    }
  }

  const createOrder = async () => {
    if (!newOrder.description || !newOrder.amount) return
    
    setLoading(true)
    try {
      // Here you would interact with the smart contract
      console.log('Creating order:', newOrder)
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000))
      setNewOrder({ description: '', amount: '' })
      fetchOrders()
    } catch (error) {
      console.error('Error creating order:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <h1 className="text-3xl font-bold text-gray-900">ZK Marketplace</h1>
            <ConnectButton />
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        {!isConnected ? (
          <div className="text-center py-12">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              Welcome to ZK Marketplace
            </h2>
            <p className="text-gray-600 mb-8">
              Connect your wallet to start trading with zero-knowledge privacy
            </p>
            <ConnectButton />
          </div>
        ) : (
          <div className="space-y-8">
            {/* Create Order Section */}
            <div className="bg-white shadow rounded-lg p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Create New Order</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Description</label>
                  <input
                    type="text"
                    value={newOrder.description}
                    onChange={(e) => setNewOrder({...newOrder, description: e.target.value})}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                    placeholder="Describe your order..."
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Amount (ETH)</label>
                  <input
                    type="number"
                    step="0.001"
                    value={newOrder.amount}
                    onChange={(e) => setNewOrder({...newOrder, amount: e.target.value})}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                    placeholder="0.1"
                  />
                </div>
                <button
                  onClick={createOrder}
                  disabled={loading}
                  className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 disabled:opacity-50"
                >
                  {loading ? 'Creating...' : 'Create Order'}
                </button>
              </div>
            </div>

            {/* Orders List */}
            <div className="bg-white shadow rounded-lg">
              <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="text-xl font-semibold text-gray-900">Orders</h2>
              </div>
              <div className="divide-y divide-gray-200">
                {orders.length === 0 ? (
                  <div className="px-6 py-4 text-center text-gray-500">
                    No orders found. Create your first order above!
                  </div>
                ) : (
                  orders.map((order) => (
                    <div key={order.id} className="px-6 py-4">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="text-sm font-medium text-gray-900">
                            Order #{order.order_id}
                          </p>
                          <p className="text-sm text-gray-600">{order.description}</p>
                          <p className="text-xs text-gray-500">
                            Buyer: {order.buyer_address} | Seller: {order.seller_address}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-medium text-gray-900">
                            {(order.amount_wei / 1e18).toFixed(4)} ETH
                          </p>
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                            order.status === 'completed' ? 'bg-green-100 text-green-800' :
                            order.status === 'funded' ? 'bg-blue-100 text-blue-800' :
                            order.status === 'disputed' ? 'bg-red-100 text-red-800' :
                            'bg-yellow-100 text-yellow-800'
                          }`}>
                            {order.status}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Contract Info */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h3 className="text-sm font-medium text-blue-900">Contract Information</h3>
              <p className="text-sm text-blue-700 mt-1">
                Contract Address: {CONTRACT_ADDRESS}
              </p>
              <p className="text-sm text-blue-700">
                Network: Localhost (Chain ID: 1337)
              </p>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

