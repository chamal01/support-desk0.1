import React, { useState, useMemo, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, doc, setDoc, updateDoc, onSnapshot } from 'firebase/firestore';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { 
  Ticket, 
  LayoutDashboard, 
  PlusCircle, 
  MessageSquare, 
  User, 
  Clock, 
  AlertCircle, 
  CheckCircle2, 
  ChevronRight, 
  Search, 
  Menu,
  X,
  Shield,
  Send,
  Sparkles,
  Loader2,
  Wand2,
  LogOut,
  Lock,
  Users
} from 'lucide-react';


const apiKey = "AIzaSyChvNNv_jFj2m3aTfEREbbi11O2TswsocY"; 

async function callGeminiAPI(prompt) {
  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }]
      })
    });
    const data = await response.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  } catch (error) {
    console.error("Gemini API Error:", error);
    return "Sorry, there was an error generating the content.";
  }
}

const firebaseConfig = {
  apiKey: "AIzaSyA-aNHy52SGoy2oMp5a8AFu8SwMKnMWsvA",
  authDomain: "support-desk-abf28.firebaseapp.com",
  projectId: "support-desk-abf28",
  storageBucket: "support-desk-abf28.firebasestorage.app",
  messagingSenderId: "967251721974",
  appId: "1:967251721974:web:12cad0698b1298c7a3b6d7",
  measurementId: "G-D1WYNKET4H"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const appId = 'local-support-desk';


const initialUsers = [
  { id: 'U-101', name: 'System Admin', email: 'admin@example.com', password: 'password', role: 'Admin' },
  { id: 'U-102', name: 'Support Agent', email: 'agent@example.com', password: 'password', role: 'Agent' },
  { id: 'U-103', name: 'John Doe', email: 'customer@example.com', password: 'password', role: 'Customer' },
];

const initialTickets = [
  {
    id: 'TKT-1001',
    title: 'Cannot access my account',
    description: 'I keep getting an "Invalid Credentials" error even though I just reset my password. Please help me log in.',
    status: 'Open',
    priority: 'High',
    author: 'customer@example.com',
    createdAt: new Date(Date.now() - 86400000 * 2).toISOString(),
    comments: [
      { id: 1, author: 'Support Agent', text: 'Hi John, I reset your session on our end. Can you try clearing your browser cache and logging in again?', timestamp: new Date(Date.now() - 86400000 * 1.5).toISOString() },
      { id: 2, author: 'John Doe', text: 'That worked! Thank you.', timestamp: new Date(Date.now() - 86400000 * 1).toISOString() }
    ]
  },
  {
    id: 'TKT-1002',
    title: 'Billing issue for pro subscription',
    description: 'My credit card was charged twice for the monthly subscription this month.',
    status: 'In Progress',
    priority: 'Medium',
    author: 'agent@example.com',
    createdAt: new Date(Date.now() - 3600000 * 5).toISOString(),
    comments: []
  }
];


const formatDate = (dateString) => {
  const options = { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' };
  return new Date(dateString).toLocaleDateString('en-US', options);
};

const getStatusColor = (status) => {
  switch (status) {
    case 'Open': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    case 'In Progress': return 'bg-blue-100 text-blue-800 border-blue-200';
    case 'Closed': return 'bg-green-100 text-green-800 border-green-200';
    default: return 'bg-gray-100 text-gray-800 border-gray-200';
  }
};

const getPriorityColor = (priority) => {
  switch (priority) {
    case 'High': return 'text-red-600 bg-red-50';
    case 'Medium': return 'text-orange-600 bg-orange-50';
    case 'Low': return 'text-gray-600 bg-gray-50';
    default: return 'text-gray-600 bg-gray-50';
  }
};

export default function App() {

  const [firebaseUser, setFirebaseUser] = useState(null);
  const [isDbReady, setIsDbReady] = useState(false);
  const [users, setUsers] = useState([]);
  const [currentUser, setCurrentUser] = useState(null); 
  const [tickets, setTickets] = useState([]);
  

  const [authError, setAuthError] = useState(false);
  const [permissionError, setPermissionError] = useState(false);


  const [currentView, setCurrentView] = useState('dashboard');
  const [activeTicketId, setActiveTicketId] = useState(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');


  useEffect(() => {
    const initAuth = async () => {
      try {
        await signInAnonymously(auth);
      } catch (err) {
        console.error("Auth error:", err);
        setAuthError(true);
      }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, setFirebaseUser);
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!firebaseUser) return;
    
    let usersLoaded = false;
    let ticketsLoaded = false;
    const checkReady = () => { if (usersLoaded && ticketsLoaded) setIsDbReady(true); };

    const handleFirebaseError = (error) => {
      console.error("Firestore Error:", error);
      if (error.code === 'permission-denied') {
        setPermissionError(true);
      }
    };


    const usersRef = collection(db, 'artifacts', appId, 'public', 'data', 'users');
    const unsubscribeUsers = onSnapshot(usersRef, async (snapshot) => {
      try {
        const fetchedUsers = snapshot.docs.map(doc => doc.data());
        if (fetchedUsers.length === 0) {
          for (const u of initialUsers) {
            await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'users', u.id), u);
          }
        } else {
          setUsers(fetchedUsers);
          usersLoaded = true;
          checkReady();
        }
      } catch (e) { handleFirebaseError(e); }
    }, handleFirebaseError);

   
    const ticketsRef = collection(db, 'artifacts', appId, 'public', 'data', 'tickets');
    const unsubscribeTickets = onSnapshot(ticketsRef, async (snapshot) => {
      try {
        const fetchedTickets = snapshot.docs.map(doc => doc.data());
        if (fetchedTickets.length === 0) {
          for (const t of initialTickets) {
            await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'tickets', t.id), t);
          }
        } else {
          setTickets(fetchedTickets);
          ticketsLoaded = true;
          checkReady();
        }
      } catch (e) { handleFirebaseError(e); }
    }, handleFirebaseError);

    return () => {
      unsubscribeUsers();
      unsubscribeTickets();
    };
  }, [firebaseUser]);


  const isAgentOrAdmin = currentUser?.role === 'Agent' || currentUser?.role === 'Admin';
  const isAdmin = currentUser?.role === 'Admin';

  const visibleTickets = useMemo(() => {
    if (!currentUser) return [];
    let filtered = tickets;
    
    if (currentUser.role === 'Customer') filtered = filtered.filter(t => t.author === currentUser.email);
    if (statusFilter !== 'All') filtered = filtered.filter(t => t.status === statusFilter);
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(t => t.title.toLowerCase().includes(q) || t.id.toLowerCase().includes(q) || t.author.toLowerCase().includes(q));
    }
    return filtered.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }, [tickets, currentUser, statusFilter, searchQuery]);

  const stats = useMemo(() => {
    if (!currentUser) return { total: 0, open: 0, inProgress: 0, closed: 0 };
    const relevantTickets = isAgentOrAdmin ? tickets : tickets.filter(t => t.author === currentUser.email);
    return {
      total: relevantTickets.length,
      open: relevantTickets.filter(t => t.status === 'Open').length,
      inProgress: relevantTickets.filter(t => t.status === 'In Progress').length,
      closed: relevantTickets.filter(t => t.status === 'Closed').length,
    };
  }, [tickets, currentUser, isAgentOrAdmin]);

  const activeTicket = tickets.find(t => t.id === activeTicketId);

 
  const handleLogin = (email, password) => {
    const user = users.find(u => u.email === email && u.password === password);
    if (user) {
      setCurrentUser(user);
      setCurrentView(user.role === 'Admin' ? 'users' : 'dashboard');
      return true;
    }
    return false;
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setCurrentView('dashboard');
  };

  const handleCreateTicket = async (newTicket) => {
    const ticketId = `TKT-${Math.floor(1000 + Math.random() * 9000)}`;
    const ticket = {
      id: ticketId,
      ...newTicket,
      status: 'Open',
      author: currentUser.email,
      createdAt: new Date().toISOString(),
      comments: []
    };
    await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'tickets', ticketId), ticket);
    setCurrentView('list');
  };

  const handleAddComment = async (ticketId, commentText) => {
    const ticketRef = doc(db, 'artifacts', appId, 'public', 'data', 'tickets', ticketId);
    const ticket = tickets.find(t => t.id === ticketId);
    if (ticket) {
      const newComment = {
        id: Date.now(),
        author: currentUser.name,
        text: commentText,
        timestamp: new Date().toISOString()
      };
      await updateDoc(ticketRef, { comments: [...ticket.comments, newComment] });
    }
  };

  const handleChangeStatus = async (ticketId, newStatus) => {
    const ticketRef = doc(db, 'artifacts', appId, 'public', 'data', 'tickets', ticketId);
    await updateDoc(ticketRef, { status: newStatus });
  };

  const handleCreateUser = async (newUser) => {
    const userId = `U-${Math.floor(100 + Math.random() * 900)}`;
    const user = { id: userId, ...newUser };
    await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'users', userId), user);
  };

  const navigateTo = (view, ticketId = null) => {
    setCurrentView(view);
    setActiveTicketId(ticketId);
    setIsMobileMenuOpen(false);
  };

 
  if (authError) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <div className="max-w-2xl w-full bg-white rounded-2xl shadow-sm border border-slate-200 p-8 text-center">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-slate-800 mb-2">Authentication Not Enabled</h2>
          <p className="text-slate-600 mb-6">Your Firebase project is rejecting the login. You need to enable Anonymous Sign-in.</p>
          <div className="bg-slate-50 p-6 rounded-xl text-left border border-slate-100">
            <h3 className="font-semibold text-slate-800 mb-3">How to fix this:</h3>
            <ol className="list-decimal list-inside space-y-2 text-sm text-slate-700">
              <li>Go to the <a href="https://console.firebase.google.com/" target="_blank" rel="noreferrer" className="text-indigo-600 hover:underline font-semibold">Firebase Console</a> and open your project.</li>
              <li>Click <strong>Build</strong> &rarr; <strong>Authentication</strong> in the left menu.</li>
              <li>Click the <strong>Get Started</strong> button (if you haven't already).</li>
              <li>Go to the <strong>Sign-in method</strong> tab.</li>
              <li>Scroll down, click on <strong>Anonymous</strong>, switch it to <strong>Enable</strong>, and click Save.</li>
              <li className="font-medium text-indigo-700 mt-2">Refresh this page once you're done!</li>
            </ol>
          </div>
        </div>
      </div>
    );
  }

  if (permissionError) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <div className="max-w-2xl w-full bg-white rounded-2xl shadow-sm border border-slate-200 p-8 text-center">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-slate-800 mb-2">Database Permission Denied</h2>
          <p className="text-slate-600 mb-6">Your database is locked. You need to update your Firestore security rules to allow read/write access.</p>
          <div className="bg-slate-50 p-6 rounded-xl text-left border border-slate-100">
            <h3 className="font-semibold text-slate-800 mb-3">How to fix this:</h3>
            <ol className="list-decimal list-inside space-y-2 text-sm text-slate-700">
              <li>Go to the <a href="https://console.firebase.google.com/" target="_blank" rel="noreferrer" className="text-indigo-600 hover:underline font-semibold">Firebase Console</a>.</li>
              <li>Click <strong>Build</strong> &rarr; <strong>Firestore Database</strong>.</li>
              <li>Click on the <strong>Rules</strong> tab at the top.</li>
              <li>Replace all the rules with this test code and click <strong>Publish</strong>:</li>
            </ol>
            <pre className="bg-slate-800 text-slate-300 p-4 rounded-lg text-xs mt-3 overflow-x-auto shadow-inner">
{`rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if true;
    }
  }
}`}
            </pre>
            <p className="font-medium text-indigo-700 mt-4 text-sm">Once published, refresh this page!</p>
          </div>
        </div>
      </div>
    );
  }

  if (!firebaseUser || !isDbReady) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center">
        <Loader2 className="w-10 h-10 animate-spin text-indigo-600 mb-4" />
        <p className="text-slate-500 font-medium animate-pulse">Connecting to Firebase Database...</p>
      </div>
    );
  }

  if (!currentUser) {
    return <LoginView onLogin={handleLogin} />;
  }

  return (
    <div className="min-h-screen bg-slate-50 flex font-sans">
      
      {/* Mobile Sidebar Overlay */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/50 z-20 md:hidden" 
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed inset-y-0 left-0 z-30 w-64 bg-slate-900 text-slate-300 transform transition-transform duration-200 ease-in-out flex flex-col
        ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
        md:relative
      `}>
        <div className="h-16 flex items-center px-6 border-b border-slate-800 justify-between">
          <div className="flex items-center text-white font-bold text-xl tracking-tight">
            <Ticket className="w-6 h-6 mr-2 text-indigo-400" />
            SupportDesk
          </div>
          <button className="md:hidden text-slate-400 hover:text-white" onClick={() => setIsMobileMenuOpen(false)}>
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="flex-1 px-4 py-6 overflow-y-auto space-y-1">
          {isAdmin && (
            <button 
              onClick={() => navigateTo('users')}
              className={`w-full flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-colors ${currentView === 'users' ? 'bg-indigo-600 text-white' : 'hover:bg-slate-800 hover:text-white'}`}
            >
              <Users className="w-5 h-5 mr-3" />
              User Management
            </button>
          )}

          <button 
            onClick={() => navigateTo('dashboard')}
            className={`w-full flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-colors ${currentView === 'dashboard' ? 'bg-indigo-600 text-white' : 'hover:bg-slate-800 hover:text-white'}`}
          >
            <LayoutDashboard className="w-5 h-5 mr-3" />
            Dashboard
          </button>
          
          <button 
            onClick={() => navigateTo('list')}
            className={`w-full flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-colors ${['list', 'detail'].includes(currentView) ? 'bg-indigo-600 text-white' : 'hover:bg-slate-800 hover:text-white'}`}
          >
            <Ticket className="w-5 h-5 mr-3" />
            Tickets
          </button>
          
          {!isAdmin && (
            <button 
              onClick={() => navigateTo('create')}
              className={`w-full flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-colors ${currentView === 'create' ? 'bg-indigo-600 text-white' : 'hover:bg-slate-800 hover:text-white'}`}
            >
              <PlusCircle className="w-5 h-5 mr-3" />
              New Ticket
            </button>
          )}
        </div>

        <div className="p-4 border-t border-slate-800 bg-slate-900">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3 overflow-hidden">
              <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center text-indigo-400 font-bold shrink-0">
                {currentUser.name.charAt(0)}
              </div>
              <div className="truncate">
                <p className="text-sm font-medium text-white truncate">{currentUser.name}</p>
                <p className="text-xs text-slate-400 truncate">{currentUser.role}</p>
              </div>
            </div>
            <button 
              onClick={handleLogout}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
              title="Logout"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden bg-slate-50">
        <header className="h-16 bg-white border-b border-slate-200 flex items-center px-4 sm:px-6 lg:px-8 shrink-0 md:hidden">
          <button 
            onClick={() => setIsMobileMenuOpen(true)}
            className="p-2 -ml-2 text-slate-500 hover:bg-slate-100 rounded-lg"
          >
            <Menu className="w-6 h-6" />
          </button>
          <div className="ml-4 font-semibold text-slate-800">SupportDesk</div>
        </header>

        <div className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto">
          {currentView === 'dashboard' && <DashboardView stats={stats} visibleTickets={visibleTickets} navigateTo={navigateTo} />}
          {currentView === 'list' && <TicketListView visibleTickets={visibleTickets} navigateTo={navigateTo} searchQuery={searchQuery} setSearchQuery={setSearchQuery} statusFilter={statusFilter} setStatusFilter={setStatusFilter} />}
          {currentView === 'create' && <CreateTicketView handleCreateTicket={handleCreateTicket} navigateTo={navigateTo} currentUser={currentUser} />}
          {currentView === 'detail' && <TicketDetailView activeTicket={activeTicket} handleAddComment={handleAddComment} handleChangeStatus={handleChangeStatus} isAgentOrAdmin={isAgentOrAdmin} />}
          {currentView === 'users' && isAdmin && <AdminUsersView users={users} handleCreateUser={handleCreateUser} />}
        </div>
      </main>
    </div>
  );
}



function LoginView({ onLogin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!onLogin(email, password)) {
      setError('Invalid email or password.');
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl overflow-hidden border border-slate-100">
        <div className="p-8">
          <div className="flex items-center justify-center w-12 h-12 bg-indigo-100 rounded-xl mb-6 mx-auto text-indigo-600">
            <Lock className="w-6 h-6" />
          </div>
          <h2 className="text-2xl font-bold text-center text-slate-800 mb-2">Welcome Back</h2>
          <p className="text-slate-500 text-center mb-8 text-sm">Sign in to SupportDesk to continue.</p>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-600 text-sm rounded-lg text-center">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Email Address</label>
              <input 
                type="email" required value={email} onChange={e => setEmail(e.target.value)}
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="you@example.com"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
              <input 
                type="password" required value={password} onChange={e => setPassword(e.target.value)}
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="••••••••"
              />
            </div>
            <button type="submit" className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg transition-colors">
              Sign In
            </button>
          </form>
        </div>
        <div className="bg-slate-50 p-6 border-t border-slate-100 text-sm text-slate-600">
          <p className="font-semibold mb-2 text-slate-700">Demo Accounts:</p>
          <ul className="space-y-1">
            <li><strong>Admin:</strong> admin@example.com / password</li>
            <li><strong>Agent:</strong> agent@example.com / password</li>
            <li><strong>Customer:</strong> customer@example.com / password</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

function AdminUsersView({ users, handleCreateUser }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('Customer');

  const onSubmit = (e) => {
    e.preventDefault();
    if (!name || !email || !password) return;
    handleCreateUser({ name, email, password, role });
    setName(''); setEmail(''); setPassword(''); setRole('Customer');
  };

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      <div>
        <h2 className="text-2xl font-bold text-slate-800">User Management</h2>
        <p className="text-slate-500 mt-1">Add new users and manage system access.</p>
      </div>

      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
        <h3 className="text-lg font-semibold text-slate-800 mb-4">Create New User</h3>
        <form onSubmit={onSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Full Name</label>
            <input type="text" required value={name} onChange={e => setName(e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
            <input type="email" required value={email} onChange={e => setEmail(e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
            <input type="text" required value={password} onChange={e => setPassword(e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Role</label>
            <select value={role} onChange={e => setRole(e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 bg-white">
              <option value="Admin">Admin</option>
              <option value="Agent">Agent</option>
              <option value="Customer">Customer</option>
            </select>
          </div>
          <div className="md:col-span-2 mt-2">
            <button type="submit" className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg">
              Add User
            </button>
          </div>
        </form>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100">
          <h3 className="font-semibold text-slate-800">System Users</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50 border-b border-slate-100 text-sm font-medium text-slate-500">
              <tr>
                <th className="px-6 py-3">ID</th>
                <th className="px-6 py-3">Name</th>
                <th className="px-6 py-3">Email</th>
                <th className="px-6 py-3">Role</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {users.map(u => (
                <tr key={u.id}>
                  <td className="px-6 py-4 text-sm text-slate-500">{u.id}</td>
                  <td className="px-6 py-4 text-sm font-medium text-slate-900">{u.name}</td>
                  <td className="px-6 py-4 text-sm text-slate-500">{u.email}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2.5 py-1 rounded text-xs font-medium ${u.role === 'Admin' ? 'bg-purple-100 text-purple-700' : u.role === 'Agent' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-700'}`}>
                      {u.role}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function DashboardView({ stats, visibleTickets, navigateTo }) {
  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <h2 className="text-2xl font-bold text-slate-800">Overview</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 flex items-center space-x-4">
          <div className="p-3 bg-indigo-100 text-indigo-600 rounded-lg"><Ticket className="w-6 h-6" /></div>
          <div><p className="text-sm font-medium text-slate-500">Total Tickets</p><p className="text-2xl font-bold text-slate-800">{stats.total}</p></div>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 flex items-center space-x-4">
          <div className="p-3 bg-yellow-100 text-yellow-600 rounded-lg"><AlertCircle className="w-6 h-6" /></div>
          <div><p className="text-sm font-medium text-slate-500">Open</p><p className="text-2xl font-bold text-slate-800">{stats.open}</p></div>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 flex items-center space-x-4">
          <div className="p-3 bg-blue-100 text-blue-600 rounded-lg"><Clock className="w-6 h-6" /></div>
          <div><p className="text-sm font-medium text-slate-500">In Progress</p><p className="text-2xl font-bold text-slate-800">{stats.inProgress}</p></div>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 flex items-center space-x-4">
          <div className="p-3 bg-green-100 text-green-600 rounded-lg"><CheckCircle2 className="w-6 h-6" /></div>
          <div><p className="text-sm font-medium text-slate-500">Resolved</p><p className="text-2xl font-bold text-slate-800">{stats.closed}</p></div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center">
          <h3 className="font-semibold text-slate-800">Recent Tickets</h3>
          <button onClick={() => navigateTo('list')} className="text-sm text-indigo-600 hover:text-indigo-800 font-medium">View all</button>
        </div>
        <div className="divide-y divide-slate-100">
          {visibleTickets.slice(0, 5).map(ticket => (
            <div key={ticket.id} onClick={() => navigateTo('detail', ticket.id)} className="px-6 py-4 flex items-center justify-between hover:bg-slate-50 cursor-pointer transition-colors">
              <div className="flex-1 min-w-0 pr-4">
                <div className="flex items-center space-x-3 mb-1">
                  <span className="text-sm font-medium text-slate-900 truncate">{ticket.title}</span>
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium border ${getStatusColor(ticket.status)}`}>{ticket.status}</span>
                </div>
                <div className="text-sm text-slate-500 truncate">{ticket.id} • {ticket.author}</div>
              </div>
              <div className="text-sm text-slate-400 flex items-center">
                {formatDate(ticket.createdAt)}
                <ChevronRight className="w-4 h-4 ml-2" />
              </div>
            </div>
          ))}
          {visibleTickets.length === 0 && <div className="px-6 py-8 text-center text-slate-500">No tickets found.</div>}
        </div>
      </div>
    </div>
  );
}

function TicketListView({ visibleTickets, navigateTo, searchQuery, setSearchQuery, statusFilter, setStatusFilter }) {
  return (
    <div className="space-y-4 h-full flex flex-col max-w-6xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h2 className="text-2xl font-bold text-slate-800">Tickets</h2>
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" />
            <input 
              type="text" placeholder="Search tickets..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 w-full sm:w-64"
            />
          </div>
          <select 
            value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-indigo-500"
          >
            <option value="All">All Statuses</option>
            <option value="Open">Open</option>
            <option value="In Progress">In Progress</option>
            <option value="Closed">Closed</option>
          </select>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-100 flex-1 overflow-hidden flex flex-col">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100 text-sm font-medium text-slate-500">
                <th className="px-6 py-4">ID</th>
                <th className="px-6 py-4">Title</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Priority</th>
                <th className="px-6 py-4">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {visibleTickets.map(ticket => (
                <tr key={ticket.id} onClick={() => navigateTo('detail', ticket.id)} className="hover:bg-slate-50 cursor-pointer transition-colors group">
                  <td className="px-6 py-4 text-sm font-medium text-slate-900">{ticket.id}</td>
                  <td className="px-6 py-4">
                    <p className="text-sm font-medium text-slate-900 line-clamp-1">{ticket.title}</p>
                    <p className="text-xs text-slate-500 line-clamp-1">{ticket.author}</p>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-medium border ${getStatusColor(ticket.status)}`}>{ticket.status}</span>
                  </td>
                  <td className="px-6 py-4">
                     <span className={`px-2.5 py-1 rounded text-xs font-medium ${getPriorityColor(ticket.priority)}`}>{ticket.priority}</span>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-500 whitespace-nowrap">{formatDate(ticket.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {visibleTickets.length === 0 && (
            <div className="p-12 text-center flex flex-col items-center justify-center text-slate-500">
              <Ticket className="w-12 h-12 mb-4 text-slate-300" />
              <p className="text-lg font-medium text-slate-700">No tickets found</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function CreateTicketView({ handleCreateTicket, navigateTo, currentUser }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('Medium');
  const [isEnhancing, setIsEnhancing] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!title || !description) return;
    handleCreateTicket({ title, description, priority });
  };

  const handleEnhanceDescription = async () => {
    if (!description) return;
    setIsEnhancing(true);
    const prompt = `You are an AI assistant helping a user write a clear, polite, and detailed IT support ticket. Please rewrite and expand the following brief description to make it professional and provide clear context for the support agent. Return ONLY the rewritten description text without any markdown or quotes.\n\nBrief description: ${description}`;
    const enhancedText = await callGeminiAPI(prompt);
    setDescription(enhancedText.trim());
    setIsEnhancing(false);
  };

  return (
    <div className="max-w-2xl mx-auto w-full">
      <h2 className="text-2xl font-bold text-slate-800 mb-6">Create New Ticket</h2>
      <form onSubmit={handleSubmit} className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 space-y-6">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">Subject</label>
          <input type="text" required value={title} onChange={(e) => setTitle(e.target.value)} className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500" placeholder="Brief description of the issue" />
        </div>
        <div>
          <div className="flex justify-between items-end mb-2">
            <label className="block text-sm font-medium text-slate-700">Description</label>
            {currentUser.role === 'Customer' && (
              <button type="button" onClick={handleEnhanceDescription} disabled={isEnhancing || !description.trim()} className="text-xs flex items-center text-indigo-600 hover:text-indigo-800 font-medium disabled:opacity-50 disabled:cursor-not-allowed">
                {isEnhancing ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Sparkles className="w-3 h-3 mr-1" />}
                ✨ Enhance Details
              </button>
            )}
          </div>
          <textarea required value={description} onChange={(e) => setDescription(e.target.value)} rows="6" className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 resize-none" placeholder="Please provide as much detail as possible..." />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">Priority</label>
          <select value={priority} onChange={(e) => setPriority(e.target.value)} className="w-full sm:w-1/2 px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 bg-white">
            <option value="Low">Low</option>
            <option value="Medium">Medium</option>
            <option value="High">High</option>
          </select>
        </div>
        <div className="pt-4 flex justify-end space-x-3 border-t border-slate-100">
          <button type="button" onClick={() => navigateTo('list')} className="px-4 py-2 text-slate-600 font-medium hover:bg-slate-50 rounded-lg">Cancel</button>
          <button type="submit" className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg flex items-center"><Send className="w-4 h-4 mr-2" />Submit</button>
        </div>
      </form>
    </div>
  );
}

function TicketDetailView({ activeTicket, handleAddComment, handleChangeStatus, isAgentOrAdmin }) {
  const [newComment, setNewComment] = useState('');
  const [isDrafting, setIsDrafting] = useState(false);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [summary, setSummary] = useState('');

  useEffect(() => { setSummary(''); }, [activeTicket?.id]);

  if (!activeTicket) return <div>Ticket not found</div>;

  const submitComment = (e) => {
    e.preventDefault();
    if (!newComment.trim()) return;
    handleAddComment(activeTicket.id, newComment);
    setNewComment('');
  };

  const handleDraftReply = async () => {
    setIsDrafting(true);
    const context = `Ticket Title: ${activeTicket.title}\nDescription: ${activeTicket.description}\n\nPrevious Comments:\n${activeTicket.comments.map(c => `${c.author}: ${c.text}`).join('\n')}`;
    const prompt = `You are a helpful, professional customer support agent. Draft a short, empathetic, and helpful reply to the customer based on the context below. Sign off as 'Support Desk'.\n\nContext:\n${context}`;
    const draft = await callGeminiAPI(prompt);
    setNewComment(draft.trim());
    setIsDrafting(false);
  };

  const handleSummarize = async () => {
    setIsSummarizing(true);
    const context = `Ticket Title: ${activeTicket.title}\nDescription: ${activeTicket.description}\n\nPrevious Comments:\n${activeTicket.comments.map(c => `${c.author}: ${c.text}`).join('\n')}`;
    const prompt = `Summarize the current status and main issue of this support ticket in 2-3 short bullet points. Be concise.\n\nContext:\n${context}`;
    const summaryText = await callGeminiAPI(prompt);
    setSummary(summaryText.trim());
    setIsSummarizing(false);
  };

  return (
    <div className="flex flex-col lg:flex-row gap-6 h-full max-w-6xl mx-auto">
      <div className="flex-1 flex flex-col space-y-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
          <div className="flex items-center space-x-3 mb-4">
            <h2 className="text-2xl font-bold text-slate-800">{activeTicket.title}</h2>
            <span className={`px-3 py-1 rounded-full text-xs font-medium border ${getStatusColor(activeTicket.status)}`}>{activeTicket.status}</span>
          </div>
          <p className="text-slate-600 whitespace-pre-wrap">{activeTicket.description}</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-100 flex-1 flex flex-col overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 font-semibold text-slate-800 flex items-center"><MessageSquare className="w-5 h-5 mr-2 text-slate-400" /> Conversation</div>
          <div className="flex-1 p-6 overflow-y-auto space-y-6 bg-slate-50">
            <div className="flex space-x-4">
              <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold shrink-0">{activeTicket.author.charAt(0).toUpperCase()}</div>
              <div className="flex-1 bg-white p-4 rounded-2xl rounded-tl-none border border-slate-100 shadow-sm">
                <div className="flex justify-between items-start mb-2"><span className="font-medium text-slate-900">{activeTicket.author}</span><span className="text-xs text-slate-500">{formatDate(activeTicket.createdAt)}</span></div>
                <p className="text-slate-700 text-sm">{activeTicket.description}</p>
              </div>
            </div>
            {activeTicket.comments.map(comment => {
              const isAgent = comment.author.includes('Agent') || comment.author.includes('Admin');
              return (
                <div key={comment.id} className="flex space-x-4">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold shrink-0 ${isAgent ? 'bg-amber-100 text-amber-700' : 'bg-indigo-100 text-indigo-700'}`}>{comment.author.charAt(0).toUpperCase()}</div>
                  <div className={`flex-1 p-4 rounded-2xl rounded-tl-none border shadow-sm ${isAgent ? 'bg-amber-50 border-amber-100' : 'bg-white border-slate-100'}`}>
                    <div className="flex justify-between items-start mb-2"><span className="font-medium text-slate-900 flex items-center">{comment.author}{isAgent && <Shield className="w-3 h-3 ml-1 text-amber-500" />}</span><span className="text-xs text-slate-500">{formatDate(comment.timestamp)}</span></div>
                    <p className="text-slate-700 text-sm whitespace-pre-wrap">{comment.text}</p>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="p-4 bg-white border-t border-slate-100">
            <form onSubmit={submitComment} className="flex space-x-3">
              <textarea value={newComment} onChange={(e) => setNewComment(e.target.value)} placeholder="Type your reply here..." className="flex-1 px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 resize-none h-12 min-h-[48px] max-h-32" />
              {isAgentOrAdmin && (
                <button type="button" onClick={handleDraftReply} disabled={isDrafting} className="px-3 py-2 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200 rounded-lg flex items-center justify-center h-12 disabled:opacity-50">
                  {isDrafting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}
                </button>
              )}
              <button type="submit" disabled={!newComment.trim()} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white font-medium rounded-lg flex items-center h-12"><Send className="w-4 h-4 sm:mr-2" /><span className="hidden sm:inline">Reply</span></button>
            </form>
          </div>
        </div>
      </div>

      <div className="w-full lg:w-80 space-y-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
          <h3 className="font-semibold text-slate-800 mb-4 pb-4 border-b border-slate-100">Ticket Details</h3>
          <div className="space-y-4">
            <div><span className="block text-xs text-slate-500 mb-1">Ticket ID</span><span className="text-sm font-medium text-slate-900">{activeTicket.id}</span></div>
            <div><span className="block text-xs text-slate-500 mb-1">Requester</span><span className="text-sm font-medium text-slate-900">{activeTicket.author}</span></div>
            <div><span className="block text-xs text-slate-500 mb-1">Created</span><span className="text-sm font-medium text-slate-900">{formatDate(activeTicket.createdAt)}</span></div>
            <div><span className="block text-xs text-slate-500 mb-1">Priority</span><span className={`inline-flex px-2.5 py-1 rounded text-xs font-medium ${getPriorityColor(activeTicket.priority)}`}>{activeTicket.priority}</span></div>

            {isAgentOrAdmin && (
              <div className="pt-4 mt-4 border-t border-slate-100">
                <label className="block text-xs font-semibold text-slate-700 mb-2 uppercase tracking-wider">Update Status</label>
                <select value={activeTicket.status} onChange={(e) => handleChangeStatus(activeTicket.id, e.target.value)} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500">
                  <option value="Open">Open</option><option value="In Progress">In Progress</option><option value="Closed">Closed</option>
                </select>
              </div>
            )}
            
            {isAgentOrAdmin && (
              <div className="pt-4 mt-4 border-t border-slate-100">
                <label className="block text-xs font-semibold text-slate-700 mb-3 uppercase tracking-wider flex items-center text-indigo-700"><Wand2 className="w-3 h-3 mr-1" /> Agent AI Tools</label>
                <button onClick={handleSummarize} disabled={isSummarizing} className="w-full py-2 px-3 text-sm bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-lg flex items-center justify-center disabled:opacity-50">
                  {isSummarizing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />} ✨ Summarize Thread
                </button>
                {summary && (
                  <div className="mt-3 p-3 bg-indigo-50/50 border border-indigo-100 rounded-lg text-sm text-slate-700">
                    <div className="font-semibold text-indigo-800 mb-1 text-xs">AI Summary:</div><div className="whitespace-pre-wrap">{summary}</div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}