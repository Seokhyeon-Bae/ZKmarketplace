# Part 2: Frontend Application Structure

## 📱 Frontend Overview (`/frontend`)

The frontend is a modern Next.js application with Web3 wallet integration, real-time order management, and responsive UI design.

---

## 🎨 `/frontend/pages/index.js`

**Purpose**: Main marketplace page with order creation, listing, and management.

### Key Components:

1. **Wallet Connection**
   ```javascript
   useAccount() // Gets connected wallet address
   useConnect() // Connects wallet (MetaMask, WalletConnect)
   useDisconnect() // Disconnects wallet
   ```
   - Shows connected address
   - Connect/Disconnect buttons
   - Detects wallet changes

2. **Contract Interaction**
   ```javascript
   useContractWrite() // Write functions (createOrder, fundOrder, confirmReceipt)
   useContractRead() // Read functions (getOrder, getOrderStatus)
   ```
   - Uses Wagmi hooks for Ethereum interactions
   - Handles transaction signing
   - Waits for confirmations

3. **Order Creation Form**
   - Description input field
   - Amount input (in ETH)
   - Validation before submission
   - Creates order by calling smart contract
   - Sends ETH value with transaction

4. **Order List Display**
   - Fetches orders from backend API
   - Shows order details (ID, description, amount, status)
   - Color-coded status badges:
     - Yellow: Created (awaiting buyer)
     - Blue: Funded (awaiting confirmation)
     - Green: Confirmed (completed)
     - Red: Disputed

5. **Order Actions**
   - **Fund Order**: Buyer can fund "Created" orders
   - **Confirm Receipt**: Buyer can confirm "Funded" orders
   - Actions disabled if user is not the correct participant
   - Loading states during transactions

6. **Real-time Updates**
   - Automatically refreshes order list after transactions
   - 2-second delay to allow blockchain confirmation
   - Shows loading indicators during updates

### UI Layout:
```
Header
  ├── Logo: "ZK Marketplace"
  └── Wallet Connection Button

Main Content
  ├── Create Order Section (only if wallet connected)
  │   ├── Description Input
  │   ├── Amount Input
  │   └── Create Button
  │
  └── Order List
      └── Order Cards
          ├── Order Details
          ├── Status Badge
          └── Action Buttons
```

**Styling**: Tailwind CSS classes for responsive, modern design

---

## 🔧 `/frontend/pages/_app.js`

**Purpose**: Application wrapper providing Web3 configuration.

### Configuration:

1. **Blockchain Networks**
   ```javascript
   configureChains([mainnet, polygon, optimism, arbitrum])
   ```
   - Supports multiple networks
   - Alchemy provider for reliability
   - Fallback to public RPC

2. **Wallet Connectors**
   - MetaMask
   - WalletConnect
   - Coinbase Wallet
   - Rainbow Wallet
   - More via RainbowKit

3. **Wagmi Configuration**
   ```javascript
   createConfig({
     autoConnect: true,  // Auto-reconnect on page load
     connectors,         // Available wallets
     publicClient,       // Read blockchain data
     webSocketPublicClient // Real-time updates
   })
   ```

4. **RainbowKit Provider**
   - Beautiful wallet connection modal
   - Chain switching UI
   - Account management
   - Customizable themes

### Providers Hierarchy:
```
WagmiConfig
  └── RainbowKitProvider
      └── Your App Pages
```

---

## 🎨 `/frontend/styles/globals.css`

**Purpose**: Global styles using Tailwind CSS.

### Features:

1. **Tailwind Directives**
   ```css
   @tailwind base;      // Base styles
   @tailwind components; // Component classes
   @tailwind utilities;  // Utility classes
   ```

2. **CSS Variables**
   - Foreground/background colors
   - Dark mode support
   - Customizable theme

3. **Custom Utilities**
   - Text balance for better typography
   - Responsive breakpoints
   - Animation classes

---

## ⚙️ `/frontend/tailwind.config.js`

**Purpose**: Tailwind CSS configuration.

### Configuration:

1. **Content Paths**
   - Scans `/pages/**/*` for class usage
   - Scans `/components/**/*`
   - Purges unused CSS in production

2. **Theme Extensions**
   - Custom gradients
   - Custom colors
   - Custom spacing
   - Typography settings

3. **Plugins**
   - Can add form plugins
   - Typography plugin
   - Aspect ratio plugin

**Result**: Optimized CSS bundle with only used classes

---

## 📦 `/frontend/package.json`

**Purpose**: Frontend dependencies and scripts.

### Key Dependencies:

1. **Framework**
   - `next`: React framework with SSR
   - `react`: UI library
   - `react-dom`: DOM rendering

2. **Web3 Libraries**
   - `wagmi`: React hooks for Ethereum
   - `ethers`: Ethereum library
   - `@rainbow-me/rainbowkit`: Wallet connection UI

3. **HTTP Client**
   - `axios`: API requests to backend

4. **Styling**
   - `tailwindcss`: Utility-first CSS
   - `autoprefixer`: CSS vendor prefixes
   - `postcss`: CSS processing

### Scripts:
- `dev`: Development server (hot reload)
- `build`: Production build
- `start`: Production server
- `lint`: Code linting

---

## 🔧 `/frontend/next.config.js`

**Purpose**: Next.js configuration.

### Settings:

1. **React Strict Mode**
   - Detects problems in development
   - No impact on production

2. **SWC Minifier**
   - Faster builds
   - Better optimization

3. **Environment Variables**
   ```javascript
   NEXT_PUBLIC_CONTRACT_ADDRESS // Smart contract address
   NEXT_PUBLIC_RPC_URL          // Blockchain RPC endpoint
   ```
   - Prefix `NEXT_PUBLIC_` makes them available in browser

4. **Build Optimizations**
   - Image optimization
   - Code splitting
   - Tree shaking

---

## 🎨 `/frontend/postcss.config.js`

**Purpose**: PostCSS configuration for CSS processing.

### Plugins:
- `tailwindcss`: Process Tailwind directives
- `autoprefixer`: Add vendor prefixes automatically

**Workflow**:
```
Source CSS → Tailwind Processing → Autoprefixer → Output CSS
```

---

## 📁 Directory Structure (Empty folders for future)

### `/frontend/components/`
**Purpose**: Reusable React components (for future expansion)

**Planned Components**:
- `OrderCard.js`: Individual order display
- `WalletButton.js`: Custom wallet connection
- `StatusBadge.js`: Order status indicator
- `Layout.js`: Page layout wrapper
- `Header.js`: Navigation header
- `Footer.js`: Page footer
- `LoadingSpinner.js`: Loading indicator

---

### `/frontend/hooks/`
**Purpose**: Custom React hooks (for future expansion)

**Planned Hooks**:
- `useOrders.js`: Order fetching and management
- `useMarketplace.js`: Contract interaction wrapper
- `useReputation.js`: User reputation data
- `useDisputes.js`: Dispute management

---

### `/frontend/utils/`
**Purpose**: Utility functions (for future expansion)

**Planned Utils**:
- `formatters.js`: Format addresses, dates, amounts
- `validators.js`: Form validation
- `constants.js`: App constants
- `contracts.js`: Contract ABIs and addresses

---

## 🔄 Data Flow

### Order Creation Flow:
```
1. User fills form → 
2. Click "Create Order" → 
3. Wallet prompts for signature → 
4. Transaction sent to blockchain → 
5. Smart contract emits event → 
6. Indexer catches event → 
7. Database updated → 
8. Frontend fetches new data → 
9. UI updates
```

### Order Funding Flow:
```
1. Buyer clicks "Fund Order" → 
2. Wallet prompts for ETH payment → 
3. Transaction sent with value → 
4. Smart contract validates and stores → 
5. Event emitted → 
6. Indexer updates database → 
7. Frontend refreshes → 
8. Order shows "Funded" status
```

### Order Confirmation Flow:
```
1. Buyer receives goods → 
2. Clicks "Confirm Receipt" → 
3. Smart contract:
   - Calculates fees (2.5%)
   - Sends seller their share
   - Sends platform fee
   - Updates order status
4. Event emitted → 
5. Reputation updated → 
6. Database synced → 
7. UI shows "Confirmed"
```

---

## 🎨 UI/UX Features

### Responsive Design:
- Mobile-first approach
- Breakpoints: sm (640px), md (768px), lg (1024px), xl (1280px)
- Grid layouts adapt to screen size
- Touch-friendly buttons

### Loading States:
- Button disabled during transactions
- Loading text ("Creating...", "Funding...")
- Spinner animations
- Skeleton screens for data loading

### Error Handling:
- Transaction rejection messages
- Network error alerts
- Validation errors
- User-friendly error messages

### Accessibility:
- Semantic HTML
- ARIA labels
- Keyboard navigation
- Color contrast compliance

---

This completes Part 2: Frontend Application.

**Next Parts Available**:
- Part 3: ZK Verification & Scripts
- Part 4: Configuration & Deployment
- Part 5: Testing & Development Tools

Would you like me to continue with the next part?
