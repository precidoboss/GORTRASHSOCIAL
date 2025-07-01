import React, { useState, useEffect, createContext, useContext, useRef, useMemo, useCallback } from 'react';

// Supabase Imports - IMPORTANT: This package MUST be installed in your local project:
// npm install @supabase/supabase-js
// or
// yarn add @supabase/supabase-js
import { createClient } from '@supabase/supabase-js';

// Solana Imports - IMPORTANT: These packages MUST be installed in your local project:
// npm install @solana/web3.js @solana/spl-token @solana/wallet-adapter-react @solana/wallet-adapter-base @solana/wallet-adapter-react-ui
// AND the individual wallet adapters:
// npm install @solana/wallet-adapter-phantom @solana/wallet-adapter-solflare @solana/wallet-adapter-backpack
// or
// yarn add @solana/web3.js @solana/spl-token @solana/wallet-adapter-react @solana/wallet-adapter-base @solana/wallet-adapter-react-ui @solana/wallet-adapter-phantom @solana/wallet-adapter-solflare @solana/wallet-adapter-backpack
import { Connection, PublicKey, Transaction, SystemProgram } from '@solana/web3.js';
import { getAssociatedTokenAddress, createTransferInstruction, TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { useWallet, WalletProvider, ConnectionProvider } from '@solana/wallet-adapter-react';
import { WalletModalProvider, WalletMultiButton } from '@solana/wallet-adapter-react-ui';

// Corrected imports for individual wallet adapters
import { PhantomWalletAdapter } from '@solana/wallet-adapter-phantom';
import { SolflareWalletAdapter } from '@solana/wallet-adapter-solflare';
import { BackpackWalletAdapter } from '@solana/wallet-adapter-backpack';


// Default styles for wallet adapter UI
// The 'require' statement for CSS styles is causing a compilation error in this environment.
// Please ensure the necessary styles for the wallet adapter UI are included in your project's
// global CSS (e.g., in your main App.css or index.css) or through other means.
// For example, you might add a link tag in your public/index.html:
// <link rel="stylesheet" href="https://unpkg.com/@solana/wallet-adapter-react-ui@latest/styles.css" />
// Or import it in your main App.js/index.js if your bundler supports it:
// import '@solana/wallet-adapter-react-ui/styles.css';
// The 'require' syntax is not directly compatible with this online compiler's module resolution.

// --- Solana Testnet Configuration ---
const GORBAGANA_RPC_URL = "https://rpc.gorbagana.wtf";
const GOR_TOKEN_MINT_ADDRESS = new PublicKey("3DtKNjWYz3nfrp4GSM7Zx5sH5kDCz24PhuzNg"); // Provided GOR Token Mint Address

// --- Supabase Configuration (Moved to App.jsx for direct use) ---
// Note: import.meta.env is a Vite-specific feature for accessing environment variables.
// These lines are correct for a Vite project. The warnings you see are due to the online
// compiler's limited environment not fully supporting Vite's features.
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL; // Access from .env
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY; // Access from .env

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);


// --- Supabase Context ---
const SupabaseContext = createContext(null);

const SupabaseProvider = ({ children }) => {
    const [isSupabaseReady, setIsSupabaseReady] = useState(false);

    useEffect(() => {
        if (supabase) {
            setIsSupabaseReady(true);
        }
    }, []);

    return (
        <SupabaseContext.Provider value={{ supabase, isSupabaseReady }}>
            {children}
        </SupabaseContext.Provider>
    );
};

// --- Custom Hook for Supabase Operations ---
const useSupabase = (walletAddress) => {
    const { supabase, isSupabaseReady } = useContext(SupabaseContext);

    const getPrimaryId = useCallback(() => {
        return walletAddress;
    }, [walletAddress]);

    return { supabase, isSupabaseReady, getPrimaryId };
};

// Notification Message Box
const MessageBox = ({ message, type, onClose }) => {
    if (!message) return null;

    const bgColor = type === 'error' ? 'bg-red-500' : 'bg-green-500';
    const textColor = 'text-white';

    return (
        <div className={`fixed bottom-4 right-4 p-4 rounded-lg shadow-lg ${bgColor} ${textColor} z-50 flex items-center justify-between animate-fade-in-up`}>
            <span>{message}</span>
            <button onClick={onClose} className="ml-4 text-white font-bold">&times;</button>
        </div>
    );
};

// Tip Modal Component
const TipModal = ({ isOpen, onClose, onTipConfirm, username }) => {
    const [amount, setAmount] = useState(1);

    if (!isOpen) return null;

    const handleConfirm = () => {
        onTipConfirm(amount);
        setAmount(1);
    };

    return (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white p-6 rounded-lg shadow-lg w-80">
                <h3 className="text-xl font-bold mb-4">Tip {username}</h3>
                <p className="mb-4">Enter amount to tip in GOR:</p>
                <input
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-full p-2 border border-gray-300 rounded-md mb-4 focus:outline-none focus:ring-2 focus:ring-green-400"
                    min="1"
                />
                <div className="flex justify-end space-x-3">
                    <button
                        onClick={onClose}
                        className="bg-gray-300 text-gray-800 py-2 px-4 rounded-md hover:bg-gray-400 transition-colors duration-200"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleConfirm}
                        className="bg-green-500 text-white py-2 px-4 rounded-md hover:bg-green-600 transition-colors duration-200"
                    >
                        Tip {amount} GOR
                    </button>
                </div>
            </div>
        </div>
    );
};

// Post Component
const Post = ({ post, onLike, onComment, onRepost, onProfileClick, currentWalletAddress, onTipPost, isRepostedByCurrentUser = false }) => {
    const [showComments, setShowComments] = useState(false);
    const [newComment, setNewComment] = useState('');
    const commentRef = useRef(null);
    const [showTipModal, setShowTipModal] = useState(false);

    useEffect(() => {
        if (showComments && commentRef.current) {
            commentRef.current.focus();
        }
    }, [showComments]);

    const handleCommentSubmit = (e) => {
        e.preventDefault();
        if (newComment.trim()) {
            onComment(post.id, newComment);
            setNewComment('');
            setShowComments(false);
        }
    };

    const handleTipClick = () => {
        setShowTipModal(true);
    };

    const handleTipConfirm = (amount) => {
        onTipPost(post.author_address, amount); // Use author_address for Supabase
        setShowTipModal(false);
    };

    const isLiked = post.likes && post.likes.includes(currentWalletAddress);
    const likeButtonClass = isLiked ? 'text-red-500' : 'text-gray-500 hover:text-red-400';

    const isAuthor = post.author_address === currentWalletAddress; // Use author_address for Supabase

    return (
        <div className="bg-white p-4 rounded-lg shadow-md mb-4 border border-gray-200 animate-fade-in">
            {isRepostedByCurrentUser && (
                <p className="text-sm text-gray-500 mb-2">
                    <span className="text-green-600 font-semibold">You </span>reposted this
                </p>
            )}
            <div className="flex items-center mb-3">
                <div className="w-10 h-10 bg-green-200 rounded-full flex items-center justify-center text-green-800 font-bold text-lg mr-3 cursor-pointer"
                     onClick={() => onProfileClick(post.author_address)}> {/* Use author_address */}
                    {post.username ? post.username[0].toUpperCase() : 'U'}
                </div>
                <div>
                    <p className="font-semibold text-gray-800 cursor-pointer" onClick={() => onProfileClick(post.author_address)}>{post.username || 'Anonymous'}</p> {/* Use author_address */}
                    <p className="text-sm text-gray-500">{new Date(post.created_at).toLocaleString()}</p> {/* Use created_at */}
                </div>
            </div>
            <p className="text-gray-700 mb-4">{post.content}</p>
            {post.image_url && (
                <div className="mb-4">
                    <img src={post.image_url} alt="Post image" className="rounded-lg w-full h-auto max-h-96 object-cover" />
                </div>
            )}
            <div className="flex justify-around items-center text-gray-600 border-t border-b border-gray-200 py-2">
                <button
                    onClick={() => onLike(post.id, isLiked)}
                    className={`flex items-center space-x-1 p-2 rounded-full transition-colors duration-200 ${likeButtonClass}`}
                    disabled={!currentWalletAddress}
                >
                    <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                        <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
                    </svg>
                    <span>{post.likes_count || 0}</span> {/* Use likes_count */}
                </button>
                <button
                    onClick={() => setShowComments(!showComments)}
                    className="flex items-center space-x-1 p-2 rounded-full text-gray-500 hover:text-blue-400 transition-colors duration-200"
                    disabled={!currentWalletAddress}
                >
                    <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                        <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z"/>
                    </svg>
                    <span>{post.comments_count || 0}</span> {/* Use comments_count */}
                </button>
                <button
                    onClick={() => onRepost(post.id)}
                    className="flex items-center space-x-1 p-2 rounded-full text-gray-500 hover:text-green-400 transition-colors duration-200"
                    disabled={!currentWalletAddress}
                >
                    <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                        <path d="M17 12l-4 4v-3H7V9h6V6l4 4zm-4 7H7V5h6v2h4V5c0-1.1-.9-2-2-2H7c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h10c1.1 0 2-.9 2-2v-4h-4v2z"/>
                    </svg>
                    <span>{post.reposts_count || 0}</span> {/* Use reposts_count */}
                </button>
                {!isAuthor && currentWalletAddress && (
                    <button
                        onClick={handleTipClick}
                        className="flex items-center space-x-1 p-2 rounded-full text-gray-500 hover:text-yellow-500 transition-colors duration-200"
                    >
                        <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-1-13h2v6h-2zm0 8h2v2h-2z"/>
                        </svg>
                        <span>Tip</span>
                    </button>
                )}
            </div>

            {showComments && (
                <div className="mt-4 border-t border-gray-200 pt-4">
                    <h4 className="font-semibold mb-2 text-gray-700">Comments</h4>
                    {post.comments && post.comments.length > 0 ? (
                        post.comments.map((comment, index) => (
                            <div key={index} className="bg-gray-50 p-3 rounded-lg mb-2 text-sm border border-gray-100">
                                <p className="font-semibold text-gray-800">{comment.username || 'Anonymous'}</p>
                                <p className="text-gray-700">{comment.content}</p>
                                <p className="text-xs text-gray-500">{new Date(comment.created_at).toLocaleString()}</p> {/* Use created_at */}
                            </div>
                        ))
                    ) : (
                        <p className="text-gray-500 text-sm">No comments yet. Be the first!</p>
                    )}
                    <form onSubmit={handleCommentSubmit} className="mt-3 flex">
                        <input
                            type="text"
                            ref={commentRef}
                            value={newComment}
                            onChange={(e) => setNewComment(e.target.value)}
                            placeholder="Add a comment..."
                            className="flex-grow p-2 border border-gray-300 rounded-l-md focus:outline-none focus:ring-2 focus:ring-green-400"
                            disabled={!currentWalletAddress}
                        />
                        <button
                            type="submit"
                            className="bg-green-500 text-white px-4 py-2 rounded-r-md hover:bg-green-600 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                            disabled={!currentWalletAddress}
                        >
                            Comment
                        </button>
                    </form>
                </div>
            )}
            <TipModal
                isOpen={showTipModal}
                onClose={() => setShowTipModal(false)}
                onTipConfirm={handleTipConfirm}
                username={post.username || 'this user'}
            />
        </div>
    );
};

// Main App Component
const App = () => {
    const wallet = useWallet(); // Solana wallet hook
    const { publicKey, connected, sendTransaction } = wallet;
    const connection = useMemo(() => new Connection(GORBAGANA_RPC_URL, 'confirmed'), []);

    const currentWalletAddress = publicKey ? publicKey.toBase58() : null; // Connected wallet address
    const { supabase, isSupabaseReady, getPrimaryId } = useSupabase(currentWalletAddress); // Use Supabase hook

    const [currentPage, setCurrentPage] = useState('home');
    const [posts, setPosts] = useState([]);
    const [allUsers, setAllUsers] = useState({});
    const [currentUserProfile, setCurrentUserProfile] = useState(null);
    const [walletData, setWalletData] = useState({ gor_balance: 0, tickets_holding: [] }); // Renamed for Supabase
    const [notifications, setNotifications] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [newPostContent, setNewPostContent] = useState('');
    const [newPostImage, setNewPostImage] = useState(null); // State for image file
    const [profileEditData, setProfileEditData] = useState({ username: '', bio: '' });
    const [message, setMessage] = useState('');
    const [messageType, setMessageType] = useState('success');
    const [showProfileEditModal, setShowProfileEditModal] = useState(false);
    const [profileViewAddress, setProfileViewAddress] = useState(null);
    const [profileActiveTab, setProfileActiveTab] = useState('posts');

    // --- Message Handling ---
    const showMessage = (msg, type = 'success') => {
        setMessage(msg);
        setMessageType(type);
        setTimeout(() => setMessage(''), 3000);
    };

    // --- Dummy Data Initialization ---
    useEffect(() => {
        const initializeDummyData = async () => {
            if (!supabase || !isSupabaseReady) return;

            // Check if profiles table is empty
            const { count: profilesCount, error: profilesError } = await supabase
                .from('profiles')
                .select('wallet_address', { count: 'exact', head: true });

            if (profilesError) {
                console.error("Error checking profiles count:", profilesError);
                return;
            }

            if (profilesCount === 0) {
                console.log("Initializing dummy data...");
                const dummyUsers = [
                    { wallet_address: '68KBMSh99Hsg44GxvYmTNfReT8V2v7SPoWGfEfQmsgsEGP7yvRE6jSwBXbBRNrtmfNAZxMR69wPmiXKNgpATWwZn', username: 'Alice_W3', bio: 'Exploring the decentralized web!', followers: [], following: [], tickets_earned: 0, blocked_users: [] },
                    { wallet_address: '89LMNjWYz3nfrp4GSM7Zx5uFE8SC5sH5kDCz24PhuzNgQWERTyuiopasdfghjklzxcvbnm', username: 'Bob_Chain', bio: 'Blockchain enthusiast.', followers: [], following: [], tickets_earned: 0, blocked_users: [] },
                    { wallet_address: 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkLMNOPQRSTUVWXYZ1234567890', username: 'CryptoCat', bio: 'Meow! DeFi and NFTs.', followers: [], following: [], tickets_earned: 0, blocked_users: [] },
                ];

                const { error: usersInsertError } = await supabase.from('profiles').insert(dummyUsers);
                if (usersInsertError) {
                    console.error("Error inserting dummy users:", usersInsertError);
                    showMessage("Failed to insert dummy users.", "error");
                    return;
                }

                const dummyPosts = [
                    { author_address: '68KBMSh99Hsg44GxvYmTNfReT8V2v7SPoWGfEfQmsgsEGP7yvRE6jSwBXbBRNrtmfNAZxMR69wPmiXKNgpATWwZn', username: 'Alice_W3', content: 'Just joined this amazing Web3 social app! Loving the green theme.', likes: [], reposts: [], likes_count: 0, reposts_count: 0, comments_count: 0 },
                    { author_address: '89LMNjWYz3nfrp4GSM7Zx5uFE8SC5sH5kDCz24PhuzNgQWERTyuiopasdfghjklzxcvbnm', username: 'Bob_Chain', content: 'Decentralization is the future. Excited to connect with fellow builders here!', likes: [], reposts: [], likes_count: 0, reposts_count: 0, comments_count: 0 },
                    { author_address: 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkLMNOPQRSTUVWXYZ1234567890', username: 'CryptoCat', content: 'Anyone building on Layer 2 solutions? Share your projects!', likes: [], reposts: [], likes_count: 0, reposts_count: 0, comments_count: 0 },
                    { author_address: '68KBMSh99Hsg44GxvYmTNfReT8V2v7SPoWGfEfQmsgsEGP7yvRE6jSwBXbBRNrtmfNAZxMR69wPmiXKNgpATWwZn', username: 'Alice_W3', content: 'GM Web3 fam! What are your thoughts on soulbound tokens?', likes: [], reposts: [], likes_count: 0, reposts_count: 0, comments_count: 0 },
                ];

                const { error: postsInsertError } = await supabase.from('posts').insert(dummyPosts);
                if (postsInsertError) {
                    console.error("Error inserting dummy posts:", postsInsertError);
                    showMessage("Failed to insert dummy posts.", "error");
                    return;
                }
                showMessage("Dummy data initialized!");
            }
        };

        initializeDummyData();
    }, [supabase, isSupabaseReady]);


    // --- Data Fetching and Real-time Listeners (Adapted for Supabase) ---
    useEffect(() => {
        if (!supabase || !isSupabaseReady) return;

        const postsSubscription = supabase
            .from('posts')
            .on('*', payload => { // Listen to all changes
                // Re-fetch all posts on any change for simplicity, or implement more granular updates
                fetchPosts();
            })
            .subscribe();

        const fetchPosts = async () => {
            const { data, error } = await supabase
                .from('posts')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) {
                console.error("Error fetching posts:", error);
                showMessage("Failed to load posts.", "error");
            } else {
                setPosts(data);
            }
        };

        fetchPosts();

        return () => {
            supabase.removeSubscription(postsSubscription);
        };
    }, [supabase, isSupabaseReady]);

    useEffect(() => {
        if (!supabase || !isSupabaseReady) return;

        const profilesSubscription = supabase
            .from('profiles')
            .on('*', payload => {
                fetchAllUsers();
            })
            .subscribe();

        const fetchAllUsers = async () => {
            const { data, error } = await supabase
                .from('profiles')
                .select('*');

            if (error) {
                console.error("Error fetching all users:", error);
            } else {
                const fetchedUsersMap = {};
                data.forEach(user => {
                    fetchedUsersMap[user.wallet_address] = user;
                });
                setAllUsers(fetchedUsersMap);
            }
        };

        fetchAllUsers();

        return () => {
            supabase.removeSubscription(profilesSubscription);
        };
    }, [supabase, isSupabaseReady]);


    useEffect(() => {
        if (!supabase || !isSupabaseReady || !currentWalletAddress) return;

        // Fetch and listen for current user's profile
        const profileSubscription = supabase
            .from('profiles')
            .on('*', payload => {
                fetchCurrentUserProfile();
            })
            .eq('wallet_address', currentWalletAddress)
            .subscribe();

        const fetchCurrentUserProfile = async () => {
            const { data, error } = await supabase
                .from('profiles')
                .select('*')
                .eq('wallet_address', currentWalletAddress)
                .single();

            if (error && error.code !== 'PGRST116') { // PGRST116 means no rows found
                console.error("Error fetching current user profile:", error);
                showMessage("Failed to load your profile.", "error");
            } else if (data) {
                setCurrentUserProfile(data);
                setProfileEditData({
                    username: data.username || '',
                    bio: data.bio || ''
                });
            } else {
                // Create a basic profile if it doesn't exist
                const defaultUsername = `User_${currentWalletAddress.substring(0, 8)}`;
                const { error: insertError } = await supabase.from('profiles').insert({
                    wallet_address: currentWalletAddress,
                    username: defaultUsername,
                    bio: 'Hello, I am new here!',
                    followers: [],
                    following: [],
                    tickets_earned: 0,
                    blocked_users: []
                });
                if (insertError) {
                    console.error("Error creating default profile:", insertError);
                    showMessage("Failed to create default profile.", "error");
                } else {
                    setCurrentUserProfile({ wallet_address: currentWalletAddress, username: defaultUsername, bio: 'Hello, I am new here!', followers: [], following: [], tickets_earned: 0, blocked_users: [] });
                }
            }
        };

        fetchCurrentUserProfile();

        return () => {
            supabase.removeSubscription(profileSubscription);
        };
    }, [supabase, isSupabaseReady, currentWalletAddress]);

    useEffect(() => {
        if (!supabase || !isSupabaseReady || !currentWalletAddress) return;

        // Fetch and listen for current user's wallet data
        const walletSubscription = supabase
            .from('wallets')
            .on('*', payload => {
                fetchWalletData();
            })
            .eq('wallet_address', currentWalletAddress)
            .subscribe();

        const fetchWalletData = async () => {
            const { data, error } = await supabase
                .from('wallets')
                .select('*')
                .eq('wallet_address', currentWalletAddress)
                .single();

            if (error && error.code !== 'PGRST116') {
                console.error("Error fetching wallet data:", error);
                showMessage("Failed to load wallet data.", "error");
            } else if (data) {
                setWalletData(data);
            } else {
                // Create a default wallet entry
                const { error: insertError } = await supabase.from('wallets').insert({
                    wallet_address: currentWalletAddress,
                    gor_balance: 0, // Start with 0 as it's on-chain
                    tickets_holding: []
                });
                if (insertError) {
                    console.error("Error creating default wallet:", insertError);
                    showMessage("Failed to create default wallet.", "error");
                } else {
                    setWalletData({ wallet_address: currentWalletAddress, gor_balance: 0, tickets_holding: [] });
                }
            }
        };

        fetchWalletData();

        return () => {
            supabase.removeSubscription(walletSubscription);
        };
    }, [supabase, isSupabaseReady, currentWalletAddress]);

    useEffect(() => {
        if (!supabase || !isSupabaseReady || !currentWalletAddress) return;

        // Fetch and listen for notifications
        const notificationsSubscription = supabase
            .from('notifications')
            .on('*', payload => {
                fetchNotifications();
            })
            .eq('recipient_address', currentWalletAddress)
            .subscribe();

        const fetchNotifications = async () => {
            const { data, error } = await supabase
                .from('notifications')
                .select('*')
                .eq('recipient_address', currentWalletAddress)
                .order('created_at', { ascending: false });

            if (error) {
                console.error("Error fetching notifications:", error);
                showMessage("Failed to load notifications.", "error");
            } else {
                setNotifications(data);
            }
        };

        fetchNotifications();

        return () => {
            supabase.removeSubscription(notificationsSubscription);
        };
    }, [supabase, isSupabaseReady, currentWalletAddress]);

    // --- Actions ---

    const uploadImage = async (file) => {
        if (!file) return null;

        const fileExt = file.name.split('.').pop();
        const fileName = `${Date.now()}.${fileExt}`;
        const filePath = `post_images/${currentWalletAddress}/${fileName}`;

        const { data, error } = await supabase.storage.from('web3-social-bucket').upload(filePath, file, {
            cacheControl: '3600',
            upsert: false,
        });

        if (error) {
            console.error("Error uploading image:", error);
            showMessage(`Image upload failed: ${error.message}`, "error");
            return null;
        }

        // Supabase returns 'path' in data, not 'publicURL' directly from upload
        // We need to get the public URL separately
        const { data: publicUrlData } = supabase.storage.from('web3-social-bucket').getPublicUrl(filePath);
        
        if (publicUrlData && publicUrlData.publicUrl) {
            return publicUrlData.publicUrl;
        } else {
            console.error("Error getting public URL from Supabase storage:", publicUrlData);
            showMessage("Failed to get public URL for image.", "error");
            return null;
        }
    };


    const handlePost = async () => {
        if (!newPostContent.trim() && !newPostImage) {
            showMessage("Post content or image cannot be empty.", "error");
            return;
        }
        if (!supabase || !currentWalletAddress || !currentUserProfile || !connected) {
            showMessage("Please connect your wallet first.", "error");
            return;
        }

        let imageUrl = null;
        if (newPostImage) {
            showMessage("Uploading image...", "info");
            imageUrl = await uploadImage(newPostImage);
            if (!imageUrl) {
                return; // Stop if image upload failed
            }
        }

        try {
            const { error } = await supabase.from('posts').insert({
                author_address: currentWalletAddress,
                username: currentUserProfile.username || `User_${currentWalletAddress.substring(0, 8)}`,
                content: newPostContent,
                image_url: imageUrl, // Store image URL
                likes: [],
                reposts: [],
                likes_count: 0,
                reposts_count: 0,
                comments_count: 0
            });

            if (error) {
                console.error("Error adding post:", error);
                showMessage("Failed to create post.", "error");
            } else {
                setNewPostContent('');
                setNewPostImage(null);
                showMessage("Post created successfully!");
            }
        } catch (error) {
            console.error("Error adding post:", error);
            showMessage("Failed to create post.", "error");
        }
    };

    const handleLike = async (postId, isCurrentlyLiked) => {
        if (!supabase || !currentWalletAddress) {
            showMessage("Please connect your wallet first.", "error");
            return;
        }
        try {
            const { data: postData, error: fetchError } = await supabase
                .from('posts')
                .select('likes, likes_count')
                .eq('id', postId)
                .single();

            if (fetchError) {
                console.error("Error fetching post for like:", fetchError);
                showMessage("Failed to like/unlike post.", "error");
                return;
            }

            let updatedLikes = postData.likes || [];
            let newLikesCount = postData.likes_count || 0;

            if (isCurrentlyLiked) {
                updatedLikes = updatedLikes.filter(addr => addr !== currentWalletAddress);
                newLikesCount = Math.max(0, newLikesCount - 1);
            } else {
                updatedLikes.push(currentWalletAddress);
                newLikesCount++;
            }

            const { error: updateError } = await supabase
                .from('posts')
                .update({ likes: updatedLikes, likes_count: newLikesCount })
                .eq('id', postId);

            if (updateError) {
                console.error("Error updating post likes:", updateError);
                showMessage("Failed to like/unlike post.", "error");
            } else {
                showMessage(isCurrentlyLiked ? "Post unliked!" : "Post liked!");
            }
        } catch (error) {
            console.error("Error liking post:", error);
            showMessage("Failed to like/unlike post.", "error");
        }
    };

    const handleComment = async (postId, commentContent) => {
        if (!supabase || !currentWalletAddress || !currentUserProfile) {
            showMessage("Please connect your wallet first.", "error");
            return;
        }
        try {
            const { data: postData, error: fetchError } = await supabase
                .from('posts')
                .select('author_address, comments_count')
                .eq('id', postId)
                .single();

            if (fetchError) {
                console.error("Error fetching post for comment:", fetchError);
                showMessage("Failed to add comment.", "error");
                return;
            }

            const { error: commentInsertError } = await supabase.from('comments').insert({
                post_id: postId,
                author_address: currentWalletAddress,
                username: currentUserProfile.username || `User_${currentWalletAddress.substring(0, 8)}`,
                content: commentContent
            });

            if (commentInsertError) {
                console.error("Error adding comment:", commentInsertError);
                showMessage("Failed to add comment.", "error");
                return;
            }

            // Increment comments_count on the post
            const newCommentsCount = (postData.comments_count || 0) + 1;
            await supabase.from('posts').update({ comments_count: newCommentsCount }).eq('id', postId);


            showMessage("Comment added!");
            // Add notification to post owner
            if (postData.author_address !== currentWalletAddress) {
                await supabase.from('notifications').insert({
                    recipient_address: postData.author_address,
                    type: 'comment',
                    message: `${currentUserProfile.username || 'Someone'} commented on your post: "${commentContent.substring(0, 30)}..."`,
                    post_id: postId,
                    sender_address: currentWalletAddress,
                    read: false
                });
            }
        } catch (error) {
            console.error("Error commenting on post:", error);
            showMessage("Failed to add comment.", "error");
        }
    };

    const handleRepost = async (postId) => {
        if (!supabase || !currentWalletAddress || !currentUserProfile) {
            showMessage("Please connect your wallet first.", "error");
            return;
        }
        try {
            const { data: postData, error: fetchError } = await supabase
                .from('posts')
                .select('author_address, reposts, reposts_count')
                .eq('id', postId)
                .single();

            if (fetchError) {
                console.error("Error fetching post for repost:", fetchError);
                showMessage("Failed to repost post.", "error");
                return;
            }

            let updatedReposts = postData.reposts || [];
            let newRepostsCount = postData.reposts_count || 0;

            if (!updatedReposts.includes(currentWalletAddress)) {
                updatedReposts.push(currentWalletAddress);
                newRepostsCount++;

                const { error: updateError } = await supabase
                    .from('posts')
                    .update({ reposts: updatedReposts, reposts_count: newRepostsCount })
                    .eq('id', postId);

                if (updateError) {
                    console.error("Error updating post reposts:", updateError);
                    showMessage("Failed to repost post.", "error");
                    return;
                }

                showMessage("Post reposted!");
                // Add notification to post owner
                if (postData.author_address !== currentWalletAddress) {
                    await supabase.from('notifications').insert({
                        recipient_address: postData.author_address,
                        type: 'repost',
                        message: `${currentUserProfile.username || 'Someone'} reposted your post!`,
                        post_id: postId,
                        sender_address: currentWalletAddress,
                        read: false
                    });
                }
            } else {
                showMessage("You've already reposted this.", "error");
            }
        } catch (error) {
            console.error("Error reposting post:", error);
            showMessage("Failed to repost post.", "error");
        }
    };

    const handleProfileClick = async (profileAddress) => {
        if (!supabase) return;
        setProfileViewAddress(profileAddress);
        setProfileActiveTab('posts');
        setCurrentPage('profile');
    };

    const handleFollowToggle = async (targetAddress, isFollowing) => {
        if (!supabase || !currentWalletAddress || !currentUserProfile) {
            showMessage("Please connect your wallet first.", "error");
            return;
        }
        if (currentWalletAddress === targetAddress) {
            showMessage("You cannot follow/unfollow yourself.", "error");
            return;
        }

        try {
            // Update current user's following list
            let currentUserFollowing = currentUserProfile.following || [];
            if (isFollowing) {
                currentUserFollowing = currentUserFollowing.filter(addr => addr !== targetAddress);
            } else {
                currentUserFollowing.push(targetAddress);
            }
            const { error: currentUserUpdateError } = await supabase
                .from('profiles')
                .update({ following: currentUserFollowing })
                .eq('wallet_address', currentWalletAddress);

            if (currentUserUpdateError) throw currentUserUpdateError;

            // Update target user's followers list
            const { data: targetUserProfile, error: targetFetchError } = await supabase
                .from('profiles')
                .select('followers')
                .eq('wallet_address', targetAddress)
                .single();

            if (targetFetchError) throw targetFetchError;

            let targetUserFollowers = targetUserProfile.followers || [];
            if (isFollowing) {
                targetUserFollowers = targetUserFollowers.filter(addr => addr !== currentWalletAddress);
            } else {
                targetUserFollowers.push(currentWalletAddress);
            }
            const { error: targetUserUpdateError } = await supabase
                .from('profiles')
                .update({ followers: targetUserFollowers })
                .eq('wallet_address', targetAddress);

            if (targetUserUpdateError) throw targetUserUpdateError;

            showMessage(isFollowing ? "Unfollowed user." : "Followed user!");

            if (!isFollowing && targetAddress !== currentWalletAddress) { // Only notify on follow, not unfollow or self-follow
                await supabase.from('notifications').insert({
                    recipient_address: targetAddress,
                    type: 'follow',
                    message: `${currentUserProfile.username || 'Someone'} started following you!`,
                    sender_address: currentWalletAddress,
                    read: false
                });
            }
        } catch (error) {
            console.error("Error follow/unfollow:", error);
            showMessage(`Failed to follow/unfollow: ${error.message}`, "error");
        }
    };

    const handleBlock = async (targetAddress) => {
        if (!supabase || !currentWalletAddress || !currentUserProfile) {
            showMessage("Please connect your wallet first.", "error");
            return;
        }
        if (currentWalletAddress === targetAddress) {
            showMessage("You cannot block yourself.", "error");
            return;
        }
        try {
            let updatedBlocked = currentUserProfile.blocked_users || [];
            if (!updatedBlocked.includes(targetAddress)) {
                updatedBlocked.push(targetAddress);
                const { error } = await supabase
                    .from('profiles')
                    .update({ blocked_users: updatedBlocked })
                    .eq('wallet_address', currentWalletAddress);

                if (error) throw error;
                showMessage("User blocked successfully.");
            } else {
                showMessage("User is already blocked.", "error");
            }
        } catch (error) {
            console.error("Error blocking user:", error);
            showMessage(`Failed to block user: ${error.message}`, "error");
        }
    };

    const handleBuyTicket = async (targetAddress) => {
        if (!supabase || !currentWalletAddress || !currentUserProfile || !connected || !publicKey) {
            showMessage("Please connect your wallet first.", "error");
            return;
        }
        if (currentWalletAddress === targetAddress) {
            showMessage("You cannot buy a ticket for yourself.", "error");
            return;
        }
        if (walletData.gor_balance < 1) { // Check Supabase balance first
            showMessage("Insufficient GOR balance to buy a ticket. Please fund your wallet.", "error");
            return;
        }

        try {
            showMessage("Initiating ticket purchase transaction...", "info");

            const buyerTokenAccount = await getAssociatedTokenAddress(GOR_TOKEN_MINT_ADDRESS, publicKey);
            const receiverTokenAccount = await getAssociatedTokenAddress(GOR_TOKEN_MINT_ADDRESS, new PublicKey(targetAddress));

            const transaction = new Transaction().add(
                createTransferInstruction(
                    buyerTokenAccount, // source
                    receiverTokenAccount, // destination
                    publicKey, // owner
                    1, // amount (1 GOR)
                    [], // multiSigners
                    TOKEN_PROGRAM_ID
                )
            );

            const { blockhash } = await connection.getLatestBlockhash();
            transaction.recentBlockhash = blockhash;
            transaction.feePayer = publicKey;

            const signature = await sendTransaction(transaction, connection);
            await connection.confirmTransaction(signature, 'processed');

            showMessage("Ticket purchase transaction confirmed on-chain!", "success");

            // --- Update Supabase AFTER successful on-chain transaction ---
            // Update buyer's wallet data
            let updatedTicketsHolding = [...walletData.tickets_holding];
            const existingTicketIndex = updatedTicketsHolding.findIndex(ticket => ticket.wallet_address === targetAddress);

            if (existingTicketIndex > -1) {
                updatedTicketsHolding[existingTicketIndex] = {
                    ...updatedTicketsHolding[existingTicketIndex],
                    count: updatedTicketsHolding[existingTicketIndex].count + 1
                };
            } else {
                // Fetch target username for tickets_holding array
                const { data: targetProfile, error: targetProfileError } = await supabase
                    .from('profiles')
                    .select('username')
                    .eq('wallet_address', targetAddress)
                    .single();

                if (targetProfileError) throw targetProfileError;

                updatedTicketsHolding.push({ wallet_address: targetAddress, count: 1, username: targetProfile.username });
            }

            const { error: walletUpdateError } = await supabase
                .from('wallets')
                .update({
                    gor_balance: walletData.gor_balance - 1, // Decrement Supabase balance
                    tickets_holding: updatedTicketsHolding
                })
                .eq('wallet_address', currentWalletAddress);

            if (walletUpdateError) throw walletUpdateError;

            // Update target user's total tickets earned
            const { data: targetUser, error: targetUserError } = await supabase
                .from('profiles')
                .select('tickets_earned')
                .eq('wallet_address', targetAddress)
                .single();

            if (targetUserError) throw targetUserError;

            const { error: profileUpdateError } = await supabase
                .from('profiles')
                .update({ tickets_earned: (targetUser.tickets_earned || 0) + 1 })
                .eq('wallet_address', targetAddress);

            if (profileUpdateError) throw profileUpdateError;


            showMessage("Ticket purchase successful and Supabase updated!", "success");
            await supabase.from('notifications').insert({
                recipient_address: targetAddress,
                type: 'ticket_buy',
                message: `${currentUserProfile.username || 'Someone'} bought a ticket for you!`,
                sender_address: currentWalletAddress,
                read: false
            });
        } catch (error) {
            console.error("Error buying ticket:", error);
            showMessage(`Failed to buy ticket: ${error.message || error.toString()}`, "error");
        }
    };

    const handleSellTicket = async (targetAddress) => {
        if (!supabase || !currentWalletAddress || !currentUserProfile || !connected || !publicKey) {
            showMessage("Please connect your wallet first.", "error");
            return;
        }

        try {
            const existingTicketIndex = walletData.tickets_holding.findIndex(ticket => ticket.wallet_address === targetAddress);
            if (existingTicketIndex === -1 || walletData.tickets_holding[existingTicketIndex].count === 0) {
                showMessage("You don't hold any tickets for this user.", "error");
                return;
            }
            showMessage("Initiating ticket sale transaction...", "info");

            // For selling, you'd typically transfer the GOR back to yourself or a specific market address
            // For simplicity, we'll simulate receiving GOR and updating Supabase
            // In a real scenario, this would involve a smart contract or a peer-to-peer exchange.

            // --- Update Supabase AFTER successful (simulated) on-chain transaction ---
            let updatedTicketsHolding = [...walletData.tickets_holding];
            updatedTicketsHolding[existingTicketIndex].count -= 1;

            if (updatedTicketsHolding[existingTicketIndex].count === 0) {
                updatedTicketsHolding.splice(existingTicketIndex, 1);
            }

            const { error: walletUpdateError } = await supabase
                .from('wallets')
                .update({
                    gor_balance: walletData.gor_balance + 1, // Get 1 GOR back
                    tickets_holding: updatedTicketsHolding
                })
                .eq('wallet_address', currentWalletAddress);

            if (walletUpdateError) throw walletUpdateError;

            // Decrement target user's total tickets earned
            const { data: targetUser, error: targetUserError } = await supabase
                .from('profiles')
                .select('tickets_earned')
                .eq('wallet_address', targetAddress)
                .single();

            if (targetUserError) throw targetUserError;

            const { error: profileUpdateError } = await supabase
                .from('profiles')
                .update({ tickets_earned: Math.max(0, (targetUser.tickets_earned || 0) - 1) })
                .eq('wallet_address', targetAddress);

            if (profileUpdateError) throw profileUpdateError;

            showMessage("Ticket sold successfully! 1 GOR received.", "success");
        } catch (error) {
            console.error("Error selling ticket:", error);
            showMessage(`Failed to sell ticket: ${error.message || error.toString()}`, "error");
        }
    };


    const handleTip = async (targetAddress, amount) => {
        if (!supabase || !currentWalletAddress || !currentUserProfile || !connected || !publicKey) {
            showMessage("Please connect your wallet first.", "error");
            return;
        }
        if (currentWalletAddress === targetAddress) {
            showMessage("You cannot tip yourself.", "error");
            return;
        }
        if (walletData.gor_balance < amount) { // Check Supabase balance first
            showMessage("Insufficient GOR balance to tip. Please fund your wallet.", "error");
            return;
        }
        if (amount <= 0) {
            showMessage("Tip amount must be positive.", "error");
            return;
        }

        try {
            showMessage(`Initiating tip of ${amount} GOR to ${targetAddress.substring(0, 7)}...`, "info");

            const senderTokenAccount = await getAssociatedTokenAddress(GOR_TOKEN_MINT_ADDRESS, publicKey);
            const receiverTokenAccount = await getAssociatedTokenAddress(GOR_TOKEN_MINT_ADDRESS, new PublicKey(targetAddress));

            const transaction = new Transaction().add(
                createTransferInstruction(
                    senderTokenAccount, // source
                    receiverTokenAccount, // destination
                    publicKey, // owner
                    amount, // amount
                    [], // multiSigners
                    TOKEN_PROGRAM_ID
                )
            );

            const { blockhash } = await connection.getLatestBlockhash();
            transaction.recentBlockhash = blockhash;
            transaction.feePayer = publicKey;

            const signature = await sendTransaction(transaction, connection);
            await connection.confirmTransaction(signature, 'processed');

            showMessage("Tip transaction confirmed on-chain!", "success");

            // --- Update Supabase AFTER successful on-chain transaction ---
            const { error: senderUpdateError } = await supabase
                .from('wallets')
                .update({ gor_balance: walletData.gor_balance - amount })
                .eq('wallet_address', currentWalletAddress);

            if (senderUpdateError) throw senderUpdateError;

            // Fetch receiver's current balance to update it
            const { data: receiverWallet, error: receiverFetchError } = await supabase
                .from('wallets')
                .select('gor_balance')
                .eq('wallet_address', targetAddress)
                .single();

            if (receiverFetchError && receiverFetchError.code !== 'PGRST116') { // PGRST116 means no rows found
                throw receiverFetchError;
            }

            let receiverCurrentBalance = receiverWallet ? receiverWallet.gor_balance : 0;

            const { error: receiverUpdateError } = await supabase
                .from('wallets')
                .upsert({ wallet_address: targetAddress, gor_balance: receiverCurrentBalance + amount }, { onConflict: 'wallet_address' });

            if (receiverUpdateError) throw receiverUpdateError;


            showMessage(`Tipped ${amount} GOR to user successfully and Supabase updated!`, "success");
            await supabase.from('notifications').insert({
                recipient_address: targetAddress,
                type: 'tip',
                message: `${currentUserProfile.username || 'Someone'} tipped you ${amount} GOR!`,
                sender_address: currentWalletAddress,
                read: false
            });
        } catch (error) {
            console.error("Error tipping user:", error);
            showMessage(`Failed to tip: ${error.message || error.toString()}`, "error");
        }
    };

    const handleMarkNotificationRead = async (notificationId) => {
        if (!supabase || !currentWalletAddress) return;
        try {
            const { error } = await supabase
                .from('notifications')
                .update({ read: true })
                .eq('id', notificationId)
                .eq('recipient_address', currentWalletAddress); // Ensure user owns notification

            if (error) throw error;
        } catch (error) {
            console.error("Error marking notification read:", error);
        }
    };

    const handleSaveProfile = async () => {
        if (!supabase || !currentWalletAddress) {
            showMessage("Please connect your wallet first.", "error");
            return;
        }
        if (!profileEditData.username.trim()) {
            showMessage("Username cannot be empty.", "error");
            return;
        }
        try {
            const { error: profileUpdateError } = await supabase
                .from('profiles')
                .update({
                    username: profileEditData.username,
                    bio: profileEditData.bio
                })
                .eq('wallet_address', currentWalletAddress);

            if (profileUpdateError) throw profileUpdateError;

            // Update username in existing posts by this user (denormalized data)
            const { error: postsUpdateError } = await supabase
                .from('posts')
                .update({ username: profileEditData.username })
                .eq('author_address', currentWalletAddress);

            if (postsUpdateError) console.error("Error updating username in posts:", postsUpdateError);

            // Update username in existing comments by this user (denormalized data)
            const { error: commentsUpdateError } = await supabase
                .from('comments')
                .update({ username: profileEditData.username })
                .eq('author_address', currentWalletAddress);

            if (commentsUpdateError) console.error("Error updating username in comments:", commentsUpdateError);


            showMessage("Profile updated successfully!");
            setShowProfileEditModal(false);
        } catch (error) {
            console.error("Error updating profile:", error);
            showMessage(`Failed to update profile: ${error.message}`, "error");
        }
        
    };

    const filteredPosts = posts.filter(post =>
        post.content.toLowerCase().includes(searchTerm.toLowerCase()) ||
        post.username.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const getTrendingUsers = () => {
        const usersArray = Object.values(allUsers);
        const otherUsers = usersArray.filter(user => user.wallet_address !== currentWalletAddress);

        return otherUsers
            .map(user => ({
                ...user,
                trendingScore: (user.tickets_earned || 0) + (user.followers?.length || 0)
            }))
            .sort((a, b) => b.trendingScore - a.trendingScore)
            .slice(0, 5);
    };

    // --- Render Logic ---
    return (
        <div className="min-h-screen bg-gray-100 font-sans text-gray-900 flex flex-col md:flex-row">
            {/* Sidebar Navigation */}
            <nav className="bg-white shadow-md md:w-64 p-4 md:p-6 flex flex-row md:flex-col justify-around md:justify-start items-center md:items-start border-b md:border-r border-gray-200 fixed bottom-0 md:static w-full z-40">
                <div className="hidden md:block mb-8 text-2xl font-bold text-green-700">Web3 Social</div>
                <ul className="flex flex-row md:flex-col space-x-4 md:space-x-0 md:space-y-4 w-full justify-around md:justify-start">
                    <li>
                        <button
                            onClick={() => setCurrentPage('home')}
                            className={`flex items-center space-x-3 p-3 rounded-lg w-full text-left transition-colors duration-200 ${currentPage === 'home' ? 'bg-green-100 text-green-700 font-semibold' : 'text-gray-700 hover:bg-gray-100'}`}
                        >
                            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/></svg>
                            <span className="hidden md:inline">Home</span>
                        </button>
                    </li>
                    <li>
                        <button
                            onClick={() => handleProfileClick(currentWalletAddress)}
                            className={`flex items-center space-x-3 p-3 rounded-lg w-full text-left transition-colors duration-200 ${currentPage === 'profile' && profileViewAddress === currentWalletAddress ? 'bg-green-100 text-green-700 font-semibold' : 'text-gray-700 hover:bg-gray-100'}`}
                        >
                            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>
                            <span className="hidden md:inline">Profile</span>
                        </button>
                    </li>
                    <li>
                        <button
                            onClick={() => setCurrentPage('wallet')}
                            className={`flex items-center space-x-3 p-3 rounded-lg w-full text-left transition-colors duration-200 ${currentPage === 'wallet' ? 'bg-green-100 text-green-700 font-semibold' : 'text-gray-700 hover:bg-gray-100'}`}
                        >
                            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M21 18v1c0 1.1-.9 2-2 2H5c-1.11 0-2-.9-2-2V5c0-1.1.89-2 2-2h14c1.1 0 2 .9 2 2v1h-9c-1.11 0-2 .9-2 2v8c0 1.1.89 2 2 2h9zm-9-2h10V8H12v8zm4-2.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z"/></svg>
                            <span className="hidden md:inline">Wallet</span>
                        </button>
                    </li>
                    <li>
                        <button
                            onClick={() => setCurrentPage('notifications')}
                            className={`flex items-center space-x-3 p-3 rounded-lg w-full text-left transition-colors duration-200 ${currentPage === 'notifications' ? 'bg-green-100 text-green-700 font-semibold' : 'text-gray-700 hover:bg-gray-100'}`}
                        >
                            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2zm6-6V9c0-3.07-1.63-5.64-4.5-6.32V2.5c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.18C7.63 3.36 6 5.93 6 9v7l-2 2v1h16v-1l-2-2z"/></svg>
                            <span className="hidden md:inline">Notifications</span>
                            {notifications.filter(n => !n.read).length > 0 && (
                                <span className="ml-auto bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-full animate-bounce-fade-in">
                                    {notifications.filter(n => !n.read).length}
                                </span>
                            )}
                        </button>
                    </li>
                    <li>
                        <button
                            onClick={() => setCurrentPage('search')}
                            className={`flex items-center space-x-3 p-3 rounded-lg w-full text-left transition-colors duration-200 ${currentPage === 'search' ? 'bg-green-100 text-green-700 font-semibold' : 'text-gray-700 hover:bg-gray-100'}`}
                        >
                            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/></svg>
                            <span className="hidden md:inline">Search</span>
                        </button>
                    </li>
                    <li>
                        <button
                            onClick={() => setCurrentPage('settings')}
                            className={`flex items-center space-x-3 p-3 rounded-lg w-full text-left transition-colors duration-200 ${currentPage === 'settings' ? 'bg-green-100 text-green-700 font-semibold' : 'text-gray-700 hover:bg-gray-100'}`}
                        >
                            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M19.43 12.98c.04-.32.07-.64.07-.98s-.03-.66-.07-.98l2.11-1.65c.19-.15.24-.42.12-.64l-2-3.46c-.12-.22-.39-.3-.61-.22l-2.49 1c-.52-.4-1.09-.75-1.71-1.02L14.3 2.5c-.05-.24-.27-.42-.5-.42h-4c-.23 0-.45.18-.5.42L8.03 5.09c-.62.27-1.19.62-1.71 1.02l-2.49-1c-.22-.08-.49 0-.61.22l-2 3.46c-.12.22-.07.49.12.64l2.11 1.65c-.04.32-.07.64-.07.98s.03.66.07.98l-2.11 1.65c-.19.15-.24.42-.12.64l2 3.46c.12.22.39.3.61.22l2.49-1c.52.4 1.09.75 1.71 1.02l.34 2.59c.05.24.27.42.5.42h4c.23 0 .45-.18.5-.42l.34-2.59c.62-.27 1.19-.62 1.71-1.02l2.49 1c.22.08.49 0 .61-.22l2-3.46c.12-.22.07-.49-.12-.64l-2.11-1.65zM12 15.5c-1.93 0-3.5-1.57-3.5-3.5s1.57-3.5 3.5-3.5 3.5 1.57 3.5 3.5-1.57 3.5-3.5 3.5z"/></svg>
                            <span className="hidden md:inline">Settings</span>
                        </button>
                    </li>
                </ul>
            </nav>

            {/* Main Content Area */}
            <main className="flex-grow md:ml-64 pb-20 md:pb-0">
                {currentPage === 'home' && (
                    <div className="p-6">
                         {!connected && (
                            <div className="bg-yellow-100 border-l-4 border-yellow-500 text-yellow-700 p-4 mb-6 rounded-lg shadow-md" role="alert">
                                <p className="font-bold">Connect Your Wallet!</p>
                                <p>To post, like, comment, and interact fully, please connect your Web3 wallet (e.g., Backpack, Phantom).</p>
                                <div className="mt-3">
                                    <WalletMultiButton />
                                </div>
                            </div>
                        )}
                        <div className="bg-white p-4 rounded-lg shadow-md mb-6 border border-gray-200">
                            <textarea
                                className="w-full p-3 border border-gray-300 rounded-md mb-3 focus:outline-none focus:ring-2 focus:ring-green-400 resize-none"
                                rows="3"
                                placeholder="What's happening?"
                                value={newPostContent}
                                onChange={(e) => setNewPostContent(e.target.value)}
                                disabled={!connected}
                            ></textarea>
                            <input
                                type="file"
                                accept="image/*"
                                onChange={(e) => setNewPostImage(e.target.files[0])}
                                className="mb-3 p-2 border border-gray-300 rounded-md w-full"
                                disabled={!connected}
                            />
                            {newPostImage && <p className="text-sm text-gray-500 mb-2">Selected: {newPostImage.name}</p>}
                            <button
                                onClick={handlePost}
                                className="w-full bg-green-500 text-white py-2 px-4 rounded-md hover:bg-green-600 transition-all duration-300 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
                                disabled={!connected}
                            >
                                Post
                            </button>
                        </div>
                        {filteredPosts.length > 0 ? (
                            filteredPosts.map(post => (
                                <Post
                                    key={post.id}
                                    post={post}
                                    onLike={handleLike}
                                    onComment={handleComment}
                                    onRepost={handleRepost}
                                    onProfileClick={handleProfileClick}
                                    currentWalletAddress={currentWalletAddress}
                                    onTipPost={handleTip}
                                />
                            ))
                        ) : (
                            <p className="text-center text-gray-500">No posts yet. Be the first to share something!</p>
                        )}
                    </div>
                )}
                {currentPage === 'profile' && (
                    <div className="p-6">
                        <div className="bg-white p-6 rounded-lg shadow-md mb-6 border border-gray-200">
                            <div className="flex flex-col md:flex-row items-center md:items-start mb-4">
                                <div className="w-28 h-28 bg-green-200 rounded-full flex items-center justify-center text-green-800 font-bold text-5xl mr-0 md:mr-6 mb-4 md:mb-0 border-4 border-green-400 flex-shrink-0">
                                    {allUsers[profileViewAddress]?.username ? allUsers[profileViewAddress].username[0].toUpperCase() : 'U'}
                                </div>
                                <div className="text-center md:text-left flex-grow">
                                    <h2 className="text-3xl font-bold text-gray-800 mb-1">{allUsers[profileViewAddress]?.username || 'Anonymous'}</h2>
                                    <p className="text-gray-600 text-md mb-3">{allUsers[profileViewAddress]?.bio || 'No bio yet.'}</p>
                                    <p className="text-sm text-gray-500 mb-4">Wallet Address: <span className="font-mono text-xs bg-gray-100 px-2 py-1 rounded inline-block">{profileViewAddress?.substring(0, 7)}...{profileViewAddress?.substring(profileViewAddress.length - 4)}</span></p>

                                    <div className="flex flex-wrap justify-center md:justify-start space-x-6 text-lg mb-4">
                                        <p className="text-gray-700">Followers: <span className="font-semibold text-green-600">{allUsers[profileViewAddress]?.followers?.length || 0}</span></p>
                                        <p className="text-gray-700">Following: <span className="font-semibold text-blue-600">{allUsers[profileViewAddress]?.following?.length || 0}</span></p>
                                        <p className="text-gray-700">Tickets: <span className="font-semibold text-purple-600">{allUsers[profileViewAddress]?.tickets_earned || 0}</span></p>
                                    </div>

                                    <div className="flex flex-wrap justify-center md:justify-start space-x-3 mt-4 gap-2">
                                        {profileViewAddress === currentWalletAddress ? (
                                            <button
                                                onClick={() => setShowProfileEditModal(true)}
                                                className="bg-green-500 text-white py-2 px-4 rounded-md hover:bg-green-600 transition-colors duration-200 shadow-md"
                                            >
                                                Edit Profile
                                            </button>
                                        ) : (
                                            <>
                                                <button
                                                    onClick={() => handleFollowToggle(profileViewAddress, currentUserProfile?.following?.includes(profileViewAddress))}
                                                    className={`py-2 px-4 rounded-md transition-colors duration-200 shadow-md ${currentUserProfile?.following?.includes(profileViewAddress) ? 'bg-gray-300 text-gray-800 hover:bg-gray-400' : 'bg-green-500 text-white hover:bg-green-600'}`}
                                                    disabled={!connected}
                                                >
                                                    {currentUserProfile?.following?.includes(profileViewAddress) ? 'Unfollow' : 'Follow'}
                                                </button>
                                                <button
                                                    onClick={() => handleBlock(profileViewAddress)}
                                                    className="bg-red-500 text-white py-2 px-4 rounded-md hover:bg-red-600 transition-colors duration-200 shadow-md"
                                                    disabled={!connected}
                                                >
                                                    Block
                                                </button>
                                                <button
                                                    onClick={() => handleBuyTicket(profileViewAddress)}
                                                    className="bg-blue-500 text-white py-2 px-4 rounded-md hover:bg-blue-600 transition-colors duration-200 shadow-md"
                                                    disabled={!connected}
                                                >
                                                    Buy Ticket (1 GOR)
                                                </button>
                                                <button
                                                    onClick={() => handleTip(profileViewAddress, 10)}
                                                    className="bg-yellow-500 text-white py-2 px-4 rounded-md hover:bg-yellow-600 transition-colors duration-200 shadow-md"
                                                    disabled={!connected}
                                                >
                                                    Tip 10 GOR
                                                </button>
                                            </>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="bg-white p-4 rounded-lg shadow-md mb-6 border border-gray-200">
                            <div className="flex border-b border-gray-200 mb-4">
                                <button
                                    onClick={() => setProfileActiveTab('posts')}
                                    className={`flex-1 py-3 text-lg font-semibold transition-colors duration-200 ${profileActiveTab === 'posts' ? 'text-green-700 border-b-2 border-green-700' : 'text-gray-500 hover:text-gray-700'}`}
                                >
                                    Posts ({userPosts.length})
                                </button>
                                <button
                                    onClick={() => setProfileActiveTab('reposts')}
                                    className={`flex-1 py-3 text-lg font-semibold transition-colors duration-200 ${profileActiveTab === 'reposts' ? 'text-green-700 border-b-2 border-green-700' : 'text-gray-500 hover:text-gray-700'}`}
                                >
                                    Reposts ({userReposts.length})
                                </button>
                            </div>

                            {contentToDisplay.length > 0 ? (
                                contentToDisplay.map(post => (
                                    <Post
                                        key={post.id + (post.type === 'repost' ? '-repost' : '')}
                                        post={post}
                                        onLike={handleLike}
                                        onComment={handleComment}
                                        onRepost={handleRepost}
                                        onProfileClick={handleProfileClick}
                                        currentWalletAddress={currentWalletAddress}
                                        onTipPost={handleTip}
                                        isRepostedByCurrentUser={post.type === 'repost' && profileViewAddress === currentWalletAddress}
                                    />
                                ))
                            ) : (
                                <p className="text-center text-gray-500 py-4">
                                    {profileActiveTab === 'posts' ? 'No posts yet.' : 'No reposts yet.'}
                                </p>
                            )}
                        </div>
                        {showProfileEditModal && (
                            <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
                                <div className="bg-white p-6 rounded-lg shadow-lg w-96">
                                    <h3 className="text-xl font-bold mb-4">Edit Profile</h3>
                                    <div className="mb-4">
                                        <label htmlFor="username" className="block text-gray-700 text-sm font-bold mb-2">Username:</label>
                                        <input
                                            type="text"
                                            id="username"
                                            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:ring-2 focus:ring-green-400"
                                            value={profileEditData.username}
                                            onChange={(e) => setProfileEditData({ ...profileEditData, username: e.target.value })}
                                        />
                                    </div>
                                    <div className="mb-4">
                                        <label htmlFor="bio" className="block text-gray-700 text-sm font-bold mb-2">Bio:</label>
                                        <textarea
                                            id="bio"
                                            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:ring-2 focus:ring-green-400 resize-none"
                                            rows="3"
                                            value={profileEditData.bio}
                                            onChange={(e) => setProfileEditData({ ...profileEditData, bio: e.target.value })}
                                        ></textarea>
                                    </div>
                                    <div className="flex justify-end space-x-3">
                                        <button
                                            onClick={() => setShowProfileEditModal(false)}
                                            className="bg-gray-300 text-gray-800 py-2 px-4 rounded-md hover:bg-gray-400 transition-colors duration-200"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            onClick={handleSaveProfile}
                                            className="bg-green-500 text-white py-2 px-4 rounded-md hover:bg-green-600 transition-colors duration-200"
                                        >
                                            Save Changes
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}
                {currentPage === 'wallet' && (
                    <div className="min-h-screen bg-gray-100 font-sans text-gray-900">
                        <header className="flex justify-between items-center px-6 py-4 bg-white shadow-md">
                            <div>
                                <h1 className="text-xl font-bold text-[#0A7740]">GOR Wallet</h1>
                                <p className="text-sm text-gray-500">Connected: GOR Chain ✅</p>
                            </div>
                            <div className="flex items-center space-x-4">
                                {connected && publicKey ? (
                                     <span className="bg-green-600 text-white px-3 py-1 rounded-full truncate max-w-[100px] sm:max-w-none">
                                         {publicKey.toBase58().substring(0, 7)}...{publicKey.toBase58().substring(publicKey.toBase58().length - 4)}
                                     </span>
                                ) : (
                                    <WalletMultiButton />
                                )}
                                <button
                                    onClick={() => setCurrentPage('notifications')}
                                    className="relative text-xl text-gray-700 hover:text-green-700 transition-colors duration-200"
                                >
                                    🔔
                                    {notifications.filter(n => !n.read).length > 0 && (
                                        <span className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 rounded-full flex items-center justify-center text-white text-xs animate-ping-once">
                                            {notifications.filter(n => !n.read).length}
                                        </span>
                                    )}
                                </button>
                            </div>
                        </header>

                        <section className="max-w-4xl mx-auto mt-6 px-6">
                            <div className="bg-white p-6 rounded-lg shadow-lg mb-6 border border-green-300">
                                <h2 className="text-lg font-semibold text-[#0A7740] mb-2">Main Balance</h2>
                                <p className="text-4xl font-bold text-[#1C1C1E]">{walletData.gor_balance.toFixed(3)} GOR</p>
                                <p className="text-sm text-gray-500">Approx. ${(walletData.gor_balance * 0.8).toFixed(2)}</p>
                                <div className="mt-4 space-x-2">
                                    <button className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed" disabled={!connected}>+ Add GOR</button>
                                    <button className="bg-white border border-green-600 text-green-600 px-4 py-2 rounded-md hover:bg-green-50 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed" disabled={!connected}>Withdraw</button>
                                </div>
                            </div>

                            <div className="bg-white p-6 rounded-lg shadow-lg mb-6 border border-green-300">
                                <h2 className="text-lg font-semibold text-[#0A7740] mb-4">🎟️ Tickets You Hold</h2>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {walletData.tickets_holding.length > 0 ? (
                                        walletData.tickets_holding.map((ticket, index) => (
                                            <div key={index} className="p-4 border border-gray-200 rounded-lg hover:shadow-md transition-shadow duration-200">
                                                <div className="flex items-center space-x-3">
                                                    <div className="w-10 h-10 bg-blue-200 rounded-full flex items-center justify-center text-blue-800 font-bold text-lg">
                                                        {ticket.username ? ticket.username[0].toUpperCase() : 'U'}
                                                    </div>
                                                    <div>
                                                        <p className="font-medium text-gray-800">@{ticket.username || 'Unknown User'}</p>
                                                        <p className="text-sm text-gray-500">{ticket.count} Ticket{ticket.count !== 1 ? 's' : ''}</p>
                                                    </div>
                                                </div>
                                                <div className="mt-2 flex space-x-2">
                                                    <button onClick={() => handleProfileClick(ticket.wallet_address)} className="text-green-600 text-sm hover:underline">👀 View Profile</button>
                                                    <button onClick={() => handleSellTicket(ticket.wallet_address)} className="text-red-500 text-sm hover:underline disabled:opacity-50 disabled:cursor-not-allowed" disabled={!connected}>🗑 Sell</button>
                                                </div>
                                            </div>
                                        ))
                                    ) : (
                                        <p className="col-span-full text-center text-gray-500">You don't hold any tickets yet.</p>
                                    )}
                                </div>
                            </div>

                            <div className="bg-white p-6 rounded-lg shadow-lg border border-green-300">
                                <h2 className="text-lg font-semibold text-[#0A7740] mb-4">🧾 Recent Activity</h2>
                                <ul className="space-y-2 text-sm text-gray-700">
                                    <li>✅ Wallet connected <span className="text-gray-400">(just now)</span></li>
                                    {walletData.gor_balance !== 0 && <li>✅ Balance updated <span className="text-gray-400">(recent)</span></li>}
                                    {walletData.tickets_holding.length > 0 && <li>✅ Tickets held updated <span className="text-gray-400">(recent)</span></li>}
                                </ul>
                            </div>
                        </section>
                    </div>
                )}
                {currentPage === 'notifications' && (
                    <div className="p-6">
                        <h2 className="text-2xl font-bold text-gray-800 mb-4">Notifications</h2>
                        {notifications.length > 0 ? (
                            notifications.map(notification => (
                                <div
                                    key={notification.id}
                                    className={`bg-white p-4 rounded-lg shadow-md mb-3 border border-gray-200 cursor-pointer transition-all duration-200 ${notification.read ? 'opacity-70' : 'bg-green-50 hover:bg-green-100'}`}
                                    onClick={() => handleMarkNotificationRead(notification.id)}
                                >
                                    <p className="text-gray-800">{notification.message}</p>
                                    <p className="text-sm text-gray-500">{new Date(notification.created_at).toLocaleString()}</p>
                                </div>
                            ))
                        ) : (
                            <p className="text-center text-gray-500">No new notifications.</p>
                        )}
                    </div>
                )}
                {currentPage === 'search' && (
                    <div className="p-6">
                        <div className="bg-white p-4 rounded-lg shadow-md mb-6 border border-gray-200 flex">
                            <input
                                type="text"
                                placeholder="Search posts or users..."
                                className="flex-grow p-3 border border-gray-300 rounded-l-md focus:outline-none focus:ring-2 focus:ring-green-400"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                onKeyPress={(e) => { if (e.key === 'Enter') handleSearch(); }}
                            />
                            <button
                                onClick={() => {
                                    if (searchTerm.trim() === '') {
                                        // No specific search function needed here as filtering is client-side
                                    } else {
                                        // Trigger re-render of filtered posts
                                        setSearchTerm(searchTerm.trim());
                                    }
                                }}
                                className="bg-green-500 text-white px-6 py-3 rounded-r-md hover:bg-green-600 transition-colors duration-200"
                            >
                                Search
                            </button>
                        </div>

                        {searchTerm.trim() === '' ? (
                            <div className="bg-white p-4 rounded-lg shadow-md border border-gray-200">
                                <h3 className="text-xl font-bold text-gray-800 mb-4">🔥 Trending Users</h3>
                                {getTrendingUsers().length > 0 ? (
                                    <ul className="space-y-3">
                                        {getTrendingUsers().map(user => (
                                            <li key={user.wallet_address} className="flex items-center space-x-3 p-2 rounded-md hover:bg-gray-50 cursor-pointer transition-colors duration-200"
                                                onClick={() => handleProfileClick(user.wallet_address)}>
                                                <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center text-green-700 font-bold">
                                                    {user.username ? user.username[0].toUpperCase() : 'U'}
                                                </div>
                                                <div>
                                                    <p className="font-semibold text-gray-800">{user.username}</p>
                                                    <p className="text-sm text-gray-500">
                                                        {user.followers?.length || 0} Followers • {user.tickets_earned || 0} Tickets
                                                    </p>
                                                </div>
                                            </li>
                                        ))}
                                    </ul>
                                ) : (
                                    <p className="text-center text-gray-500">No trending users yet.</p>
                                )}
                            </div>
                        ) : (
                            <>
                                <h3 className="text-xl font-bold text-gray-800 mb-4">Search Results</h3>
                                {filteredPosts.length > 0 ? (
                                    filteredPosts.map(post => (
                                        <Post
                                            key={post.id}
                                            post={post}
                                            onLike={handleLike}
                                            onComment={handleComment}
                                            onRepost={handleRepost}
                                            onProfileClick={handleProfileClick}
                                            currentWalletAddress={currentWalletAddress}
                                            onTipPost={handleTip}
                                        />
                                    ))
                                ) : (
                                    <p className="text-center text-gray-500">No results found for "{searchTerm}".</p>
                                )}
                            </>
                        )}
                    </div>
                )}
                {currentPage === 'settings' && (
                    <div className="p-6">
                        <h2 className="text-2xl font-bold text-gray-800 mb-6">Settings</h2>

                        <div className="bg-white p-6 rounded-lg shadow-md mb-6 border border-gray-200">
                            <h3 className="text-xl font-semibold text-gray-800 mb-4">General</h3>
                            <div className="mb-4">
                                <label className="block text-gray-700 text-sm font-bold mb-2">App Version:</label>
                                <p className="text-gray-600">1.0.0</p>
                            </div>
                            <div className="mb-4">
                                <label className="block text-gray-700 text-sm font-bold mb-2">Connected Wallet Address:</label>
                                {connected && publicKey ? (
                                    <p className="text-gray-600 font-mono text-sm bg-gray-100 px-2 py-1 rounded inline-block">{publicKey.toBase58()}</p>
                                ) : (
                                    <p className="text-red-500">No wallet connected.</p>
                                )}
                            </div>
                            <div className="mb-4">
                                <label className="block text-gray-700 text-sm font-bold mb-2">Theme:</label>
                                <div className="flex items-center space-x-4">
                                    <button className="bg-green-500 text-white px-4 py-2 rounded-md">Green & White (Default)</button>
                                    <button className="bg-gray-200 text-gray-700 px-4 py-2 rounded-md cursor-not-allowed opacity-70">Dark Mode (Coming Soon)</button>
                                </div>
                            </div>
                        </div>

                        <div className="bg-white p-6 rounded-lg shadow-md mb-6 border border-gray-200">
                            <h3 className="text-xl font-semibold text-gray-800 mb-4">Notifications</h3>
                            <div className="flex items-center justify-between mb-3">
                                <label htmlFor="pushNotifications" className="text-gray-700">Enable Push Notifications</label>
                                <input type="checkbox" id="pushNotifications" className="form-checkbox h-5 w-5 text-green-600 rounded focus:ring-green-400" defaultChecked />
                            </div>
                            <div className="flex items-center justify-between">
                                <label htmlFor="emailNotifications" className="text-gray-700">Email Notifications</label>
                                <input type="checkbox" id="emailNotifications" className="form-checkbox h-5 w-5 text-green-600 rounded focus:ring-green-400" />
                            </div>
                            <p className="text-sm text-gray-500 mt-2">Note: These are placeholder settings for demonstration.</p>
                        </div>

                        <div className="bg-white p-6 rounded-lg shadow-md border border-gray-200">
                            <h3 className="text-xl font-semibold text-gray-800 mb-4">About</h3>
                            <p className="text-gray-700">This is a Web3-aligned social application, inspired by Twitter, built to demonstrate decentralized interaction concepts.</p>
                            <p className="text-gray-700 mt-2">Developed using React and Firebase Firestore for real-time data.</p>
                        </div>
                    </div>
                )}
            </main>

            <MessageBox message={message} type={messageType} onClose={() => setMessage('')} />
        </div>
    );
};

// Root component for the Supabase Provider and Solana Wallet Provider
const Root = () => {
    const wallets = useMemo(() => [
        new BackpackWalletAdapter(),
        new PhantomWalletAdapter(),
        new SolflareWalletAdapter(),
    ], []);

    return (
        <ConnectionProvider endpoint={GORBAGANA_RPC_URL}>
            <WalletProvider wallets={wallets} autoConnect>
                <WalletModalProvider>
                    <SupabaseProvider>
                        <App />
                    </SupabaseProvider>
                </WalletModalProvider>
            </WalletProvider>
        </ConnectionProvider>
    );
};

export default Root;
