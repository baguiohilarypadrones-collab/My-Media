"use client";

import { type FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { cn } from "./utils/cn";
import { firestoreDb, auth, isFirebaseConfigured, ensureAnonAuth, waitForAuth } from "@/lib/firebase";
import {
  collection,
  doc,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  setDoc,
  getDocs,
  query,
  orderBy,
  serverTimestamp,
  Timestamp,
  writeBatch,
} from "firebase/firestore";
import { onAuthStateChanged, type User } from "firebase/auth";
import { 
  Film, 
  Tv, 
  BookOpen, 
  Sparkles, 
  TrendingUp, 
  Search, 
  Grid, 
  Layers, 
  Sun, 
  Moon, 
  Plus, 
  Trash2, 
  Download, 
  Upload, 
  RotateCcw, 
  CheckCircle2, 
  Star, 
  X, 
  ChevronLeft, 
  ChevronRight,
  Info,
  Calendar,
  Layers3,
  Bookmark,
  Award
} from "lucide-react";

type MediaCategory = "movie" | "series" | "manhwa" | "anime" | "book" | "cartoon" | "drama";
type NavCategory = "overall" | MediaCategory;
type ViewMode = "carousel" | "grid";

type SeasonEntry = {
  seasonNumber: number;
  totalEpisodes: number;
};

type MediaProgress = {
  currentChapter?: number;
  totalChapters?: number;
  currentEpisode?: number;
  totalEpisodes?: number;
  currentSeason?: number;
  totalSeasons?: number;
  seasons?: SeasonEntry[];
  currentPage?: number;
  totalPages?: number;
  watched?: boolean;
  watchPercentage?: number;
};

type MediaItem = {
  _id: string;
  title: string;
  category: MediaCategory;
  coverImage: string;
  description: string;
  genres: string[];
  rating: number;
  recommended: boolean;
  createdAt: string;
  updatedAt: string;
  progress: MediaProgress;
  owner?: string;
};

type MediaSections = {
  recentlyUpdated: MediaItem[];
  recommendations: MediaItem[];
  random: MediaItem[];
};

type MediaLinks = Record<string, { prequelIds: string[]; sequelIds: string[] }>;

type AddFormState = {
  title: string;
  category: MediaCategory;
  coverImage: string;
  description: string;
  genres: string;
  rating: number;
  currentChapter: number;
  totalChapters: number;
  currentEpisode: number;
  currentSeason: number;
  totalSeasons: number;
  seasons: SeasonEntry[];
  currentPage: number;
  totalPages: number;
  watched: boolean;
  watchPercentage: number;
  prequelIds: string[];
  sequelIds: string[];
};

const navItems: Array<{ label: string; value: NavCategory; icon: any }> = [
  { label: "Overall", value: "overall", icon: Layers },
  { label: "Movies", value: "movie", icon: Film },
  { label: "Series", value: "series", icon: Tv },
  { label: "Dramas", value: "drama", icon: Tv },
  { label: "Manhwa", value: "manhwa", icon: BookOpen },
  { label: "Anime", value: "anime", icon: Sparkles },
  { label: "Books", value: "book", icon: BookOpen },
  { label: "Cartoons", value: "cartoon", icon: Sparkles },
];

const categoryLabel: Record<MediaCategory, string> = {
  manhwa: "Manhwa",
  anime: "Anime",
  series: "Series",
  drama: "Drama",
  movie: "Movie",
  book: "Book",
  cartoon: "Cartoon",
};

const categoryThemeColor: Record<MediaCategory, string> = {
  manhwa: "bg-purple-500/10 text-purple-500 border-purple-500/20",
  anime: "bg-indigo-500/10 text-indigo-500 border-indigo-500/20",
  series: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  drama: "bg-rose-500/10 text-rose-500 border-rose-500/20",
  movie: "bg-amber-500/10 text-amber-500 border-amber-500/20",
  book: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
  cartoon: "bg-cyan-500/10 text-cyan-500 border-cyan-500/20",
};

const PRESET_COVERS = [
  { label: "Anime Art", url: "https://images.unsplash.com/photo-1578632767115-351597cf2477?auto=format&fit=crop&w=600&q=80" },
  { label: "Cinema Theatre", url: "https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?auto=format&fit=crop&w=600&q=80" },
  { label: "Book Stack", url: "https://images.unsplash.com/photo-1544947950-fa07a98d237f?auto=format&fit=crop&w=600&q=80" },
  { label: "Cosy TV Lounge", url: "https://images.unsplash.com/photo-1522869635100-9f4c5e86aa37?auto=format&fit=crop&w=600&q=80" },
  { label: "Creative Canvas", url: "https://images.unsplash.com/photo-1560942485-b2a11cc13456?auto=format&fit=crop&w=600&q=80" },
  { label: "Comics & Sketch", url: "https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?auto=format&fit=crop&w=600&q=80" },
];

const SUGGESTED_GENRES = ["Action", "Sci-Fi", "Fantasy", "Drama", "Comedy", "Adventure", "Romance", "Mystery", "Thriller", "Self-Help", "Psychology"];

function makeSeasons(count: number): SeasonEntry[] {
  return Array.from({ length: Math.max(count, 1) }, (_, i) => ({
    seasonNumber: i + 1,
    totalEpisodes: 12,
  }));
}

const defaultForm: AddFormState = {
  title: "",
  category: "anime",
  coverImage: "",
  description: "",
  genres: "",
  rating: 8.0,
  currentChapter: 1,
  totalChapters: 100,
  currentEpisode: 1,
  currentSeason: 1,
  totalSeasons: 1,
  seasons: makeSeasons(1),
  currentPage: 1,
  totalPages: 300,
  watched: false,
  watchPercentage: 0,
  prequelIds: [],
  sequelIds: [],
};

const LOCAL_ITEMS_KEY = "media_tracker_items_v2";
const LOCAL_LINKS_KEY = "media_tracker_links_v2";
const LOCAL_DARK_KEY = "media_tracker_dark_v2";

const SAMPLE_MEDIA: MediaItem[] = [
  {
    _id: "sample-1",
    title: "Solo Leveling",
    category: "manhwa",
    coverImage: "https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?auto=format&fit=crop&w=600&q=80",
    description: "In a world where hunters must battle deadly monsters to protect mankind, the weakest hunter Sung Jinwoo finds himself in an endless struggle for survival, only to obtain a mysterious Leveling Up System.",
    genres: ["Action", "Fantasy", "Adventure", "System"],
    rating: 9.2,
    recommended: true,
    createdAt: new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 2 * 3600 * 1000).toISOString(),
    progress: {
      currentChapter: 150,
      totalChapters: 179
    }
  },
  {
    _id: "sample-2",
    title: "Interstellar",
    category: "movie",
    coverImage: "https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=600&q=80",
    description: "A team of explorers travel through a wormhole in space in an attempt to ensure humanity's survival on a dusty, dying Earth.",
    genres: ["Sci-Fi", "Drama", "Space", "Adventure"],
    rating: 9.5,
    recommended: true,
    createdAt: new Date(Date.now() - 15 * 24 * 3600 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 25 * 3600 * 1000).toISOString(),
    progress: {
      watched: false,
      watchPercentage: 85
    }
  },
  {
    _id: "sample-3",
    title: "Frieren: Beyond Journey's End",
    category: "anime",
    coverImage: "https://images.unsplash.com/photo-1578632767115-351597cf2477?auto=format&fit=crop&w=600&q=80",
    description: "An elf mage and her former party members' journey after completing their decade-long quest to defeat the Demon King. The anime explores friendship, mortality, and time passing.",
    genres: ["Fantasy", "Slice of Life", "Adventure", "Magic"],
    rating: 9.7,
    recommended: true,
    createdAt: new Date(Date.now() - 4 * 24 * 3600 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
    progress: {
      currentEpisode: 16,
      totalEpisodes: 28,
      currentSeason: 1,
      totalSeasons: 1,
      seasons: [
        { seasonNumber: 1, totalEpisodes: 28 }
      ]
    }
  },
  {
    _id: "sample-4",
    title: "Breaking Bad",
    category: "series",
    coverImage: "https://images.unsplash.com/photo-1522869635100-9f4c5e86aa37?auto=format&fit=crop&w=600&q=80",
    description: "A chemistry high school teacher diagnosed with inoperable lung cancer turns to manufacturing and selling high-grade methamphetamine with a former student to secure his family's future.",
    genres: ["Crime", "Drama", "Thriller"],
    rating: 9.8,
    recommended: true,
    createdAt: new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 5 * 24 * 3600 * 1000).toISOString(),
    progress: {
      currentEpisode: 8,
      totalEpisodes: 62,
      currentSeason: 5,
      totalSeasons: 5,
      seasons: [
        { seasonNumber: 1, totalEpisodes: 7 },
        { seasonNumber: 2, totalEpisodes: 13 },
        { seasonNumber: 3, totalEpisodes: 13 },
        { seasonNumber: 4, totalEpisodes: 13 },
        { seasonNumber: 5, totalEpisodes: 16 }
      ]
    }
  },
  {
    _id: "sample-5",
    title: "Atomic Habits",
    category: "book",
    coverImage: "https://images.unsplash.com/photo-1544947950-fa07a98d237f?auto=format&fit=crop&w=600&q=80",
    description: "Tiny Changes, Remarkable Results. An easy & proven way to build good habits and break bad ones. Extremely useful for self-discipline.",
    genres: ["Self-Help", "Non-Fiction", "Productivity"],
    rating: 8.8,
    recommended: false,
    createdAt: new Date(Date.now() - 20 * 24 * 3600 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 10 * 24 * 3600 * 1000).toISOString(),
    progress: {
      currentPage: 215,
      totalPages: 320
    }
  }
];

const INITIAL_LINKS: MediaLinks = {
  "sample-3": { prequelIds: [], sequelIds: [] },
  "sample-4": { prequelIds: [], sequelIds: [] },
};

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

export default function App() {
  // Offline-first States initialized on mount to avoid hydration mismatch
  const [activeCategory, setActiveCategory] = useState<NavCategory>("overall");
  const [allMedia, setAllMedia] = useState<MediaItem[]>([]);
  const [links, setLinks] = useState<MediaLinks>({});
  const [searchTerm, setSearchTerm] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("carousel");
  const [darkMode, setDarkMode] = useState(false);
  const [mounted, setMounted] = useState(false);
  
  // UI states
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState<AddFormState>(defaultForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedMedia, setSelectedMedia] = useState<MediaItem | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [notification, setNotification] = useState<string | null>(null);

  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [cloudSync, setCloudSync] = useState(false);

  // Firebase Auth + Firestore real-time sync
  useEffect(() => {
    let unsubMedia: (() => void) | null = null;
    let unsubLinks: (() => void) | null = null;

    async function boot() {
      // Load dark mode preference first
      const localDark = localStorage.getItem(LOCAL_DARK_KEY);
      if (localDark) {
        setDarkMode(localDark === "true");
      } else if (typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches) {
        setDarkMode(true);
      }

      if (isFirebaseConfigured && firestoreDb && auth) {
        try {
          // try anonymous auth
          const user = await ensureAnonAuth() || await waitForAuth();
          if (user) {
            setFirebaseUser(user);
            setCloudSync(true);

            // real-time media collection listener
            const mediaCol = collection(firestoreDb, "media_items");
            const mediaQuery = query(mediaCol, orderBy("updatedAt", "desc"));
            unsubMedia = onSnapshot(mediaQuery, (snap) => {
              const items: MediaItem[] = [];
              snap.forEach((d) => {
                const data = d.data() as any;
                items.push({
                  _id: d.id,
                  title: data.title,
                  category: data.category,
                  coverImage: data.coverImage,
                  description: data.description || "",
                  genres: data.genres || [],
                  rating: data.rating ?? 0,
                  recommended: data.recommended ?? false,
                  createdAt: data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : new Date().toISOString(),
                  updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate().toISOString() : new Date().toISOString(),
                  progress: data.progress || {},
                  owner: data.owner
                });
              });
              if (items.length > 0) {
                setAllMedia(items);
              }
              setMounted(true);
            }, (err) => {
              console.warn("Firestore media snapshot failed, falling back to local:", err);
              loadFromLocal();
            });

            // links listener
            const linksCol = collection(firestoreDb, "media_links_store");
            unsubLinks = onSnapshot(query(linksCol), (snap) => {
              const newLinks: MediaLinks = {};
              snap.forEach((d) => {
                const v = d.data() as any;
                newLinks[d.id] = { prequelIds: v.prequelIds || [], sequelIds: v.sequelIds || [] };
              });
              if (Object.keys(newLinks).length > 0) {
                setLinks(newLinks);
              }
            });

            // Seed Firestore if empty
            setTimeout(async () => {
              try {
                const checkSnap = await getDocs(query(collection(firestoreDb!, "media_items")));
                if (checkSnap.empty) {
                  const batch = writeBatch(firestoreDb!);
                  SAMPLE_MEDIA.forEach((s) => {
                    const ref = doc(firestoreDb!, "media_items", s._id);
                    batch.set(ref, {
                      title: s.title,
                      category: s.category,
                      coverImage: s.coverImage,
                      description: s.description,
                      genres: s.genres,
                      rating: s.rating,
                      recommended: s.recommended,
                      progress: s.progress,
                      createdAt: serverTimestamp(),
                      updatedAt: serverTimestamp(),
                      owner: "global"
                    });
                  });
                  await batch.commit();
                }
              } catch (e) {
                console.log("Seed check skipped:", e);
              }
            }, 1800);

            return;
          }
        } catch (e) {
          console.warn("Firebase boot failed, using localStorage:", e);
        }
      }

      // fallback to localStorage
      loadFromLocal();
    }

    function loadFromLocal() {
      const localItems = localStorage.getItem(LOCAL_ITEMS_KEY);
      const localLinks = localStorage.getItem(LOCAL_LINKS_KEY);
      if (localItems) {
        try { setAllMedia(JSON.parse(localItems)); } catch { setAllMedia(SAMPLE_MEDIA); }
      } else {
        setAllMedia(SAMPLE_MEDIA);
        localStorage.setItem(LOCAL_ITEMS_KEY, JSON.stringify(SAMPLE_MEDIA));
      }
      if (localLinks) {
        try { setLinks(JSON.parse(localLinks)); } catch { setLinks(INITIAL_LINKS); }
      } else {
        setLinks(INITIAL_LINKS);
        localStorage.setItem(LOCAL_LINKS_KEY, JSON.stringify(INITIAL_LINKS));
      }
      setMounted(true);
    }

    void boot();

    return () => {
      if (unsubMedia) unsubMedia();
      if (unsubLinks) unsubLinks();
    };
  }, []);

  // Persist dark mode locally always
  useEffect(() => {
    if (mounted) {
      localStorage.setItem(LOCAL_DARK_KEY, String(darkMode));
    }
  }, [darkMode, mounted]);

  // Save to localStorage as offline cache (even when using Firebase)
  useEffect(() => {
    if (mounted && allMedia.length > 0) {
      localStorage.setItem(LOCAL_ITEMS_KEY, JSON.stringify(allMedia));
    }
  }, [allMedia, mounted]);

  useEffect(() => {
    if (mounted && Object.keys(links).length > 0) {
      localStorage.setItem(LOCAL_LINKS_KEY, JSON.stringify(links));
    }
  }, [links, mounted]);

  // Show a disappearing auto-dismiss notification
  const notify = (msg: string) => {
    setNotification(msg);
    setTimeout(() => {
      setNotification(null);
    }, 4000);
  };

  // Precalculated computed indexes
  const mediaById = useMemo(() => {
    const map: Record<string, MediaItem> = {};
    for (const item of allMedia) {
      map[item._id] = item;
    }
    return map;
  }, [allMedia]);

  const mediaOptions = useMemo(() => {
    return allMedia.map((item) => ({ id: item._id, title: item.title }));
  }, [allMedia]);

  // Dynamic Statistics computed from local media
  const stats = useMemo(() => {
    const total = allMedia.length;
    let completed = 0;
    let inProgress = 0;
    let ratingSum = 0;
    let ratedCount = 0;

    allMedia.forEach((item) => {
      if (item.rating > 0) {
        ratingSum += item.rating;
        ratedCount++;
      }

      // Determine completion status
      const { progress, category } = item;
      if (category === "manhwa") {
        if (progress.currentChapter && progress.totalChapters && progress.currentChapter >= progress.totalChapters) {
          completed++;
        } else if (progress.currentChapter && progress.currentChapter > 0) {
          inProgress++;
        }
      } else if (["anime", "cartoon", "series", "drama"].includes(category)) {
        if (progress.currentEpisode && progress.totalEpisodes && progress.currentEpisode >= progress.totalEpisodes && progress.currentSeason && progress.totalSeasons && progress.currentSeason >= progress.totalSeasons) {
          completed++;
        } else if (progress.currentEpisode && progress.currentEpisode > 0) {
          inProgress++;
        }
      } else if (category === "book") {
        if (progress.currentPage && progress.totalPages && progress.currentPage >= progress.totalPages) {
          completed++;
        } else if (progress.currentPage && progress.currentPage > 0) {
          inProgress++;
        }
      } else if (category === "movie") {
        if (progress.watched || (progress.watchPercentage && progress.watchPercentage >= 100)) {
          completed++;
        } else if (progress.watchPercentage && progress.watchPercentage > 0) {
          inProgress++;
        }
      }
    });

    return {
      total,
      completed,
      inProgress: Math.max(0, total - completed), // Everything not completed is either planned or in progress
      avgRating: ratedCount ? (ratingSum / ratedCount).toFixed(1) : "0.0",
    };
  }, [allMedia]);

  // Helper functions for progress rendering
  function getSeasonEpisodes(progress: MediaProgress, seasonNum: number): number {
    const entry = (progress.seasons || []).find((s) => s.seasonNumber === seasonNum);
    return entry?.totalEpisodes ?? progress.totalEpisodes ?? 12;
  }

  function getTotalAllEpisodes(progress: MediaProgress): number {
    if (progress.seasons && progress.seasons.length > 0) {
      return progress.seasons.reduce((sum, s) => sum + s.totalEpisodes, 0);
    }
    return (progress.totalSeasons ?? 1) * (progress.totalEpisodes ?? 12);
  }

  function getProgressPercentage(item: MediaItem): number {
    const p = item.progress;
    if (item.category === "manhwa") {
      if (!p.totalChapters) return 0;
      return clamp(Math.round(((p.currentChapter ?? 0) / p.totalChapters) * 100), 0, 100);
    }
    if (["anime", "cartoon", "series", "drama"].includes(item.category)) {
      // Calculate episodes completed so far
      // All episodes in previous seasons + current episodes in current season
      const totalAllEps = getTotalAllEpisodes(p);
      if (!totalAllEps) return 0;

      let watchedEps = 0;
      const currentSeason = p.currentSeason ?? 1;
      const seasons = p.seasons || [];

      for (let i = 1; i < currentSeason; i++) {
        const sEntry = seasons.find((s) => s.seasonNumber === i);
        watchedEps += sEntry ? sEntry.totalEpisodes : (p.totalEpisodes ? Math.ceil(p.totalEpisodes / (p.totalSeasons || 1)) : 12);
      }
      watchedEps += p.currentEpisode ?? 0;
      return clamp(Math.round((watchedEps / totalAllEps) * 100), 0, 100);
    }
    if (item.category === "book") {
      if (!p.totalPages) return 0;
      return clamp(Math.round(((p.currentPage ?? 0) / p.totalPages) * 100), 0, 100);
    }
    if (item.category === "movie") {
      return p.watched ? 100 : (p.watchPercentage ?? 0);
    }
    return 0;
  }

  function formatProgress(item: MediaItem) {
    const { progress } = item;

    if (item.category === "manhwa") {
      return `Chapter ${progress.currentChapter ?? 0} / ${progress.totalChapters ?? 0}`;
    }

    if (["anime", "cartoon", "series", "drama"].includes(item.category)) {
      const seasonEps = getSeasonEpisodes(progress, progress.currentSeason ?? 1);
      return `Season ${progress.currentSeason ?? 1} • Episode ${progress.currentEpisode ?? 0} / ${seasonEps}`;
    }

    if (item.category === "book") {
      return `Page ${progress.currentPage ?? 0} / ${progress.totalPages ?? 0}`;
    }

    return progress.watched ? "Watched ✓" : `Progress ${progress.watchPercentage ?? 0}%`;
  }

  function totalsSummary(item: MediaItem) {
    const p = item.progress;

    if (item.category === "manhwa") {
      return `Total Chapters: ${p.totalChapters ?? 0}`;
    }

    if (["anime", "cartoon", "series", "drama"].includes(item.category)) {
      const total = getTotalAllEpisodes(p);
      return `Seasons: ${p.totalSeasons ?? 1} | Total Episodes: ${total}`;
    }

    if (item.category === "book") {
      return `Total Pages: ${p.totalPages ?? 0}`;
    }

    return p.watched ? "Completed" : "In Progress";
  }

  // Handle Quick Progression Increments
  const patchProgressValue = async (id: string, updates: Partial<MediaProgress>) => {
    // Optimistic local update first
    let mergedProgress: MediaProgress | null = null;
    setAllMedia((prev) => 
      prev.map((item) => {
        if (item._id === id) {
          const updatedProgress = { ...item.progress, ...updates };
          
          // If we reached the final cap, auto-toggle completion states where applicable
          if (item.category === "manhwa" && updatedProgress.currentChapter && updatedProgress.totalChapters) {
            if (updatedProgress.currentChapter >= updatedProgress.totalChapters) {
              updatedProgress.currentChapter = updatedProgress.totalChapters;
            }
          }
          if (item.category === "book" && updatedProgress.currentPage && updatedProgress.totalPages) {
            if (updatedProgress.currentPage >= updatedProgress.totalPages) {
              updatedProgress.currentPage = updatedProgress.totalPages;
            }
          }
          
          mergedProgress = updatedProgress;

          const updatedItem = {
            ...item,
            progress: updatedProgress,
            updatedAt: new Date().toISOString()
          };

          // Update details modal if it's currently open
          if (selectedMedia?._id === id) {
            setSelectedMedia(updatedItem);
          }

          return updatedItem;
        }
        return item;
      })
    );
    notify("Progress adjusted!");

    // Cloud sync: Firestore
    if (cloudSync && firestoreDb && mergedProgress) {
      try {
        const ref = doc(firestoreDb, "media_items", id);
        await updateDoc(ref, {
          progress: mergedProgress,
          updatedAt: serverTimestamp(),
        });
      } catch (e) {
        console.warn("Firestore progress update failed, kept local:", e);
      }
    }
    // Also keep localStorage as offline cache
  };

  const handleEdit = (item: MediaItem) => {
    const rel = links[item._id] || { prequelIds: [], sequelIds: [] };
    const totalSeasons = item.progress.totalSeasons || 1;
    const existingSeasons = item.progress.seasons || [];
    
    const seasons: SeasonEntry[] = Array.from({ length: totalSeasons }, (_, i) => {
      const existing = existingSeasons.find((s) => s.seasonNumber === i + 1);
      return { 
        seasonNumber: i + 1, 
        totalEpisodes: existing?.totalEpisodes ?? item.progress.totalEpisodes ?? 12 
      };
    });

    setEditingId(item._id);
    setForm({
      title: item.title,
      category: item.category,
      coverImage: item.coverImage,
      description: item.description,
      genres: item.genres.join(", "),
      rating: item.rating,
      currentChapter: item.progress.currentChapter || 0,
      totalChapters: item.progress.totalChapters || 100,
      currentEpisode: item.progress.currentEpisode || 0,
      currentSeason: item.progress.currentSeason || 1,
      totalSeasons,
      seasons,
      currentPage: item.progress.currentPage || 0,
      totalPages: item.progress.totalPages || 300,
      watched: item.progress.watched || false,
      watchPercentage: item.progress.watchPercentage || 0,
      prequelIds: rel.prequelIds || [],
      sequelIds: rel.sequelIds || [],
    });
    setAddOpen(true);
  };

  const buildProgressFromForm = (f: AddFormState): MediaProgress => {
    if (f.category === "manhwa") {
      return {
        currentChapter: clamp(f.currentChapter, 0, f.totalChapters),
        totalChapters: Math.max(f.totalChapters, 1),
      };
    }

    if (["anime", "cartoon", "series", "drama"].includes(f.category)) {
      const totalSeasons = Math.max(f.totalSeasons, 1);
      const seasons = f.seasons.slice(0, totalSeasons).map((s, i) => ({
        seasonNumber: i + 1,
        totalEpisodes: Math.max(s.totalEpisodes, 1),
      }));
      const currentSeason = clamp(f.currentSeason, 1, totalSeasons);
      const currentSeasonEps = seasons[currentSeason - 1]?.totalEpisodes ?? 12;
      const totalEpisodes = seasons.reduce((sum, s) => sum + s.totalEpisodes, 0);

      return {
        currentEpisode: clamp(f.currentEpisode, 0, currentSeasonEps),
        totalEpisodes,
        currentSeason,
        totalSeasons,
        seasons,
      };
    }

    if (f.category === "book") {
      return {
        currentPage: clamp(f.currentPage, 0, f.totalPages),
        totalPages: Math.max(f.totalPages, 1),
      };
    }

    return {
      watched: f.watched,
      watchPercentage: clamp(f.watchPercentage, 0, 100),
    };
  };

  // Prequels & Sequels updates
  const saveLinksState = (targetId: string, prequelIds: string[], sequelIds: string[]) => {
    setLinks((current) => {
      const next = { ...current };

      // Clean old connections of this target first
      const oldRel = current[targetId] || { prequelIds: [], sequelIds: [] };
      for (const pid of oldRel.prequelIds) {
        if (next[pid]) {
          next[pid] = {
            ...next[pid],
            sequelIds: (next[pid].sequelIds || []).filter((id) => id !== targetId),
          };
        }
      }
      for (const sid of oldRel.sequelIds) {
        if (next[sid]) {
          next[sid] = {
            ...next[sid],
            prequelIds: (next[sid].prequelIds || []).filter((id) => id !== targetId),
          };
        }
      }

      // Establish new connections
      next[targetId] = { prequelIds, sequelIds };

      // For every prequel, append this target as sequel
      for (const pid of prequelIds) {
        const existing = next[pid] || { prequelIds: [], sequelIds: [] };
        const sequels = new Set(existing.sequelIds || []);
        sequels.add(targetId);
        next[pid] = { ...existing, sequelIds: [...sequels] };
      }

      // For every sequel, append this target as prequel
      for (const sid of sequelIds) {
        const existing = next[sid] || { prequelIds: [], sequelIds: [] };
        const prequels = new Set(existing.prequelIds || []);
        prequels.add(targetId);
        next[sid] = { ...existing, prequelIds: [...prequels] };
      }

      return next;
    });
  };

  const handleSaveSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) return;

    const formattedGenres = form.genres
      .split(",")
      .map((g) => g.trim())
      .filter((g) => g.length > 0);

    const coverUrl = form.coverImage.trim() || PRESET_COVERS[0].url;

    const progressObj = buildProgressFromForm(form);

    const payloadBase = {
      title: form.title.trim(),
      category: form.category,
      coverImage: coverUrl,
      description: form.description.trim() || "No description provided.",
      genres: formattedGenres,
      rating: form.rating,
      recommended: form.rating >= 8.5,
      progress: progressObj,
      updatedAt: new Date().toISOString(),
    };

    if (editingId) {
      // Update locally first (optimistic)
      setAllMedia((prev) =>
        prev.map((item) =>
          item._id === editingId
            ? { ...item, ...payloadBase }
            : item
        )
      );
      saveLinksState(editingId, form.prequelIds, form.sequelIds);
      notify(`Updated "${form.title}" successfully!`);

      // Firestore cloud sync
      if (cloudSync && firestoreDb) {
        try {
          const ref = doc(firestoreDb, "media_items", editingId);
          await updateDoc(ref, {
            ...payloadBase,
            updatedAt: serverTimestamp(),
          });
        } catch (err) {
          console.warn("Firestore update failed:", err);
        }
      }
    } else {
      // Create new
      const newId = `media-${Date.now()}`;
      const newItem: MediaItem = {
        _id: newId,
        ...payloadBase,
        createdAt: new Date().toISOString(),
      };

      setAllMedia((prev) => [newItem, ...prev]);
      saveLinksState(newId, form.prequelIds, form.sequelIds);
      notify(`Added "${form.title}" successfully!`);

      // Firestore cloud sync
      if (cloudSync && firestoreDb) {
        try {
          const colRef = collection(firestoreDb, "media_items");
          const docRef = await addDoc(colRef, {
            title: payloadBase.title,
            category: payloadBase.category,
            coverImage: payloadBase.coverImage,
            description: payloadBase.description,
            genres: payloadBase.genres,
            rating: payloadBase.rating,
            recommended: payloadBase.recommended,
            progress: payloadBase.progress,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            owner: firebaseUser?.uid || "anon",
          });
          // Replace temporary local ID with Firestore ID
          setAllMedia((prev) => prev.map(m => m._id === newId ? { ...m, _id: docRef.id } : m));
        } catch (err) {
          console.warn("Firestore create failed, kept local:", err);
        }
      }
    }

    setAddOpen(false);
    setForm(defaultForm);
    setEditingId(null);
  };

  const handleDeleteItem = async (id: string) => {
    // Remove references to this item in prequel/sequels
    setLinks((current) => {
      const next = { ...current };
      delete next[id];
      // remove from all others
      Object.keys(next).forEach((key) => {
        next[key] = {
          prequelIds: (next[key].prequelIds || []).filter((item) => item !== id),
          sequelIds: (next[key].sequelIds || []).filter((item) => item !== id),
        };
      });
      return next;
    });

    setAllMedia((prev) => prev.filter((item) => item._id !== id));
    setDeleteConfirmId(null);
    setSelectedMedia(null);
    setAddOpen(false);
    notify("Media card was deleted.");

    // Firestore cloud sync
    if (cloudSync && firestoreDb) {
      try {
        await deleteDoc(doc(firestoreDb, "media_items", id));
      } catch (err) {
        console.warn("Firestore delete failed:", err);
      }
    }
  };

  // Auto seasons length adjuster
  const handleTotalSeasonsChange = (val: number) => {
    const clampedVal = Math.max(val, 1);
    setForm((curr) => {
      const existing = curr.seasons;
      const nextSeasons = Array.from({ length: clampedVal }, (_, i) => {
        if (i < existing.length) return existing[i];
        return { seasonNumber: i + 1, totalEpisodes: 12 };
      });
      return {
        ...curr,
        totalSeasons: clampedVal,
        seasons: nextSeasons,
        currentSeason: clamp(curr.currentSeason, 1, clampedVal),
      };
    });
  };

  // Seed sample data again
  const handleResetToSamples = () => {
    if (confirm("Are you sure you want to reset your collection to the default sample media cards? This will overwrite your current list.")) {
      setAllMedia(SAMPLE_MEDIA);
      setLinks(INITIAL_LINKS);
      setActiveCategory("overall");
      notify("Collection reset to default demo items!");
    }
  };

  // Export database as JSON file
  const handleExportData = () => {
    const dataObj = {
      media: allMedia,
      links: links,
      exportedAt: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(dataObj, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `media_flow_backup_${new Date().toISOString().split("T")[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    notify("Backup downloaded successfully!");
  };

  // Import database from JSON file
  const handleImportData = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        if (Array.isArray(parsed.media)) {
          setAllMedia(parsed.media);
          if (parsed.links) {
            setLinks(parsed.links);
          }
          notify("Backup restored successfully!");
        } else {
          alert("Invalid file format. Ensure it is a valid Media Flow Backup JSON.");
        }
      } catch (err) {
        alert("Failed to parse JSON file.");
      }
    };
    reader.readAsText(file);
    // clear input
    e.target.value = "";
  };

  // Filter & Search
  const normalizedSearch = searchTerm.trim().toLowerCase();

  const filteredMedia = useMemo(() => {
    let result = allMedia;

    // Filter by nav category
    if (activeCategory !== "overall") {
      result = result.filter((item) => item.category === activeCategory);
    }

    // Filter by search terms
    if (normalizedSearch) {
      result = result.filter((item) => {
        const textToMatch = `${item.title} ${item.description} ${item.genres.join(" ")} ${item.category}`.toLowerCase();
        return textToMatch.includes(normalizedSearch);
      });
    }

    return result;
  }, [allMedia, activeCategory, normalizedSearch]);

  // Carousel view partitions
  const sections = useMemo((): MediaSections => {
    // Recently Updated: first 6 items sorted by updatedAt
    const recentlyUpdated = [...filteredMedia].sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    ).slice(0, 6);

    // Highly Recommended: items with rating >= 8.5
    const recommendations = filteredMedia.filter((item) => item.rating >= 8.5).slice(0, 6);

    // Random: randomized selection
    const random = [...filteredMedia].sort(() => 0.5 - Math.random()).slice(0, 6);

    return { recentlyUpdated, recommendations, random };
  }, [filteredMedia]);

  // Carousel horizontal scroll triggers
  const recentlyUpdatedRef = useRef<HTMLDivElement>(null);
  const recommendationsRef = useRef<HTMLDivElement>(null);
  const randomRef = useRef<HTMLDivElement>(null);

  const scrollContainer = (ref: React.RefObject<HTMLDivElement | null>, offset: number) => {
    if (ref.current) {
      ref.current.scrollBy({ left: offset, behavior: "smooth" });
    }
  };

  // Count active categories counts
  const categoryCounts = useMemo(() => {
    const counts: Record<NavCategory, number> = {
      overall: allMedia.length,
      movie: 0,
      series: 0,
      drama: 0,
      manhwa: 0,
      anime: 0,
      book: 0,
      cartoon: 0
    };
    navItems.forEach((it) => {
      if (it.value !== "overall") {
        counts[it.value] = allMedia.filter((m) => m.category === it.value).length;
      }
    });
    return counts;
  }, [allMedia]);

  if (!mounted) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-900 text-slate-100">
        <div className="text-center space-y-4">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent" />
          <p className="text-sm font-semibold tracking-widest text-slate-400 uppercase">Loading Media Collection...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("min-h-screen transition-colors duration-300", darkMode ? "bg-slate-950 text-slate-100" : "bg-slate-50 text-slate-800")}>
      
      {/* Toast Notification */}
      {notification && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-3 text-sm font-medium text-white shadow-2xl border border-slate-700 animate-bounce">
          <span className="h-2 w-2 rounded-full bg-emerald-400 animate-ping" />
          <span>{notification}</span>
        </div>
      )}

      {/* Header Bar */}
      <header className={cn("sticky top-0 z-20 border-b backdrop-blur-md transition-colors", darkMode ? "border-slate-800 bg-slate-950/90" : "border-slate-200 bg-white/90")}>
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-4 py-4 sm:px-6 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-600 text-white shadow-md">
                <Layers3 className="h-4 w-4" />
              </span>
              <p className="text-xs font-bold uppercase tracking-[0.25em] text-indigo-500">
                {cloudSync ? "☁️ Firebase Cloud Sync" : "Offline Workspace"}
              </p>
              {cloudSync && (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-emerald-500 border border-emerald-500/20">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  Live
                </span>
              )}
              {!isFirebaseConfigured && (
                <span className="inline-flex items-center rounded-full bg-amber-500/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-amber-600 border border-amber-500/20">
                  Local Only
                </span>
              )}
            </div>
            <h1 className="mt-1 text-2xl font-black tracking-tight">Media Flow Tracker</h1>
            <p className={cn("text-xs", darkMode ? "text-slate-400" : "text-slate-500")}>
              {cloudSync
                ? `Cloud synced • ${firebaseUser ? `UID: ${firebaseUser.uid.slice(0,8)}…` : "connected"} • ${allMedia.length} cards`
                : "Your local database dashboard — configure Firebase to enable cloud sync."}
            </p>
          </div>

          {/* Quick Actions Panel */}
          <div className="flex flex-wrap items-center gap-2">
            <button 
              onClick={() => setViewMode((c) => (c === "carousel" ? "grid" : "carousel"))} 
              title="Switch layout format"
              className={cn("flex items-center gap-1.5 rounded-xl border px-3.5 py-2 text-xs font-semibold transition-all", 
                darkMode 
                  ? "border-slate-800 bg-slate-900 hover:border-slate-700 hover:bg-slate-800 text-slate-100" 
                  : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50 text-slate-700")}
            >
              {viewMode === "carousel" ? (
                <>
                  <Grid className="h-3.5 w-3.5 text-indigo-500" />
                  <span>Grid Layout</span>
                </>
              ) : (
                <>
                  <Layers className="h-3.5 w-3.5 text-indigo-500" />
                  <span>Carousel Layout</span>
                </>
              )}
            </button>

            <button 
              onClick={() => setDarkMode(!darkMode)} 
              title="Toggle Light/Dark Theme"
              className={cn("rounded-xl border p-2 transition-all", 
                darkMode 
                  ? "border-slate-800 bg-slate-900 hover:bg-slate-800 text-yellow-400" 
                  : "border-slate-200 bg-white hover:bg-slate-50 text-slate-600 hover:text-slate-900")}
            >
              {darkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>

            {/* Backups & Restore Tools */}
            <div className="flex items-center gap-1">
              <button
                onClick={handleExportData}
                title="Download your collection data as JSON backup"
                className={cn("flex items-center gap-1 rounded-xl border px-2.5 py-2 text-xs font-semibold transition",
                  darkMode ? "border-slate-800 bg-slate-900 text-slate-300 hover:bg-slate-800" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50")}
              >
                <Download className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Export</span>
              </button>
              
              <label 
                title="Import database backup from JSON"
                className={cn("flex cursor-pointer items-center gap-1 rounded-xl border px-2.5 py-2 text-xs font-semibold transition",
                  darkMode ? "border-slate-800 bg-slate-900 text-slate-300 hover:bg-slate-800" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50")}
              >
                <Upload className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Import</span>
                <input type="file" accept=".json" onChange={handleImportData} className="hidden" />
              </label>

              <button
                onClick={handleResetToSamples}
                title="Restore default demo items"
                className={cn("flex items-center gap-1 rounded-xl border px-2.5 py-2 text-xs font-semibold text-rose-500 transition hover:bg-rose-500/10",
                  darkMode ? "border-slate-800 bg-slate-900" : "border-slate-200 bg-white")}
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Reset</span>
              </button>
            </div>

            <button 
              onClick={() => {
                setForm(defaultForm);
                setEditingId(null);
                setAddOpen(true);
              }} 
              className="flex items-center gap-1 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white shadow-lg transition hover:bg-indigo-500"
            >
              <Plus className="h-4 w-4" />
              <span>Add Media</span>
            </button>
          </div>
        </div>

        {/* Category Navigation Bar */}
        <div className="mx-auto w-full max-w-7xl px-4 pb-2 sm:px-6">
          <nav className="no-scrollbar flex gap-1.5 overflow-x-auto py-1">
            {navItems.map((item) => {
              const IconComponent = item.icon;
              const isActive = activeCategory === item.value;
              const count = categoryCounts[item.value] || 0;
              return (
                <button
                  key={item.value}
                  onClick={() => setActiveCategory(item.value)}
                  className={cn(
                    "flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold tracking-wide transition-all",
                    isActive
                      ? "bg-slate-900 text-white shadow-md dark:bg-indigo-600 dark:text-white"
                      : darkMode
                        ? "bg-slate-900 text-slate-300 hover:bg-slate-800"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  )}
                >
                  <IconComponent className="h-3 w-3 opacity-80" />
                  <span>{item.label}</span>
                  <span className={cn("ml-0.5 rounded-full px-1.5 py-0.2 text-[10px]", 
                    isActive 
                      ? "bg-white/20 text-white" 
                      : darkMode 
                        ? "bg-slate-800 text-slate-400" 
                        : "bg-slate-200 text-slate-500")}>
                    {count}
                  </span>
                </button>
              );
            })}
          </nav>
        </div>
      </header>

      {/* Main Stats Summary & Global Dashboard controls */}
      <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6">
        
        {/* Real-time stats dashboard widgets */}
        <section className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className={cn("rounded-2xl border p-4 shadow-sm", darkMode ? "border-slate-800 bg-slate-900" : "border-slate-200 bg-white")}>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Tracked Total</span>
              <Bookmark className="h-4 w-4 text-indigo-500" />
            </div>
            <p className="mt-2 text-3xl font-black">{stats.total}</p>
            <p className="mt-1 text-xs text-slate-400">Total list size</p>
          </div>

          <div className={cn("rounded-2xl border p-4 shadow-sm", darkMode ? "border-slate-800 bg-slate-900" : "border-slate-200 bg-white")}>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-500">Completed</span>
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            </div>
            <p className="mt-2 text-3xl font-black text-emerald-500">{stats.completed}</p>
            <p className="mt-1 text-xs text-slate-400">Finished tracking</p>
          </div>

          <div className={cn("rounded-2xl border p-4 shadow-sm", darkMode ? "border-slate-800 bg-slate-900" : "border-slate-200 bg-white")}>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-sky-500">In Progress</span>
              <TrendingUp className="h-4 w-4 text-sky-500" />
            </div>
            <p className="mt-2 text-3xl font-black text-sky-500">{stats.inProgress}</p>
            <p className="mt-1 text-xs text-slate-400">Ongoing items</p>
          </div>

          <div className={cn("rounded-2xl border p-4 shadow-sm", darkMode ? "border-slate-800 bg-slate-900" : "border-slate-200 bg-white")}>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-amber-500">Avg Rating</span>
              <Award className="h-4 w-4 text-amber-500" />
            </div>
            <p className="mt-2 text-3xl font-black text-amber-500">⭐ {stats.avgRating}</p>
            <p className="mt-1 text-xs text-slate-400">Out of 10 stars</p>
          </div>
        </section>

        {/* Search controls */}
        <section className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative flex-1 max-w-lg">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by title, genre, category, description..."
              className={cn("w-full rounded-2xl border py-2.5 pl-10 pr-4 text-sm outline-none transition-all", 
                darkMode 
                  ? "border-slate-800 bg-slate-900 text-slate-100 placeholder-slate-500 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500" 
                  : "border-slate-200 bg-white text-slate-800 placeholder-slate-400 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500")}
            />
            {searchTerm && (
              <button 
                onClick={() => setSearchTerm("")} 
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600"
              >
                Clear
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 text-xs font-medium text-slate-400">
            {searchTerm ? (
              <span>Found {filteredMedia.length} matching results</span>
            ) : (
              <span>Showing {filteredMedia.length} items in {activeCategory}</span>
            )}
          </div>
        </section>

        {/* Zero state feedback */}
        {filteredMedia.length === 0 && (
          <div className={cn("rounded-3xl border p-12 text-center shadow-sm", darkMode ? "border-slate-800 bg-slate-900/50" : "border-slate-200 bg-white")}>
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500">
              <Info className="h-6 w-6" />
            </div>
            <h3 className="mt-4 text-base font-bold">No media items match your filters</h3>
            <p className="mt-1 text-sm text-slate-400 max-w-sm mx-auto">
              Try changing the search query, selecting a different tab, or clicking below to add your first card.
            </p>
            <div className="mt-6 flex justify-center gap-3">
              {searchTerm && (
                <button 
                  onClick={() => setSearchTerm("")}
                  className="rounded-xl border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-600 dark:border-slate-700 dark:text-slate-300"
                >
                  Clear Search
                </button>
              )}
              <button
                onClick={() => {
                  setForm(defaultForm);
                  setEditingId(null);
                  setAddOpen(true);
                }}
                className="rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white hover:bg-indigo-500"
              >
                Add Custom Media Card
              </button>
            </div>
          </div>
        )}

        {/* Conditional Layout views */}
        {filteredMedia.length > 0 && (
          <>
            {viewMode === "carousel" ? (
              <div className="space-y-10">
                {/* Section 1: Recently Updated */}
                {sections.recentlyUpdated.length > 0 && (
                  <section className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h2 className="text-lg font-extrabold tracking-tight">Recently Updated</h2>
                        <p className={cn("text-xs", darkMode ? "text-slate-400" : "text-slate-500")}>The latest cards you touched</p>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button 
                          onClick={() => scrollContainer(recentlyUpdatedRef, -320)}
                          className="carousel-nav border-slate-200 bg-white hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-900 dark:hover:bg-slate-800"
                        >
                          <ChevronLeft className="h-4 w-4" />
                        </button>
                        <button 
                          onClick={() => scrollContainer(recentlyUpdatedRef, 320)}
                          className="carousel-nav border-slate-200 bg-white hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-900 dark:hover:bg-slate-800"
                        >
                          <ChevronRight className="h-4 w-4" />
                        </button>
                      </div>
                    </div>

                    <div 
                      ref={recentlyUpdatedRef}
                      className="no-scrollbar flex snap-x snap-mandatory gap-4 overflow-x-auto pb-4 scroll-smooth"
                    >
                      {sections.recentlyUpdated.map((item) => (
                        <div key={item._id} className="w-80 shrink-0 snap-start">
                          <MediaCardComponent 
                            item={item} 
                            darkMode={darkMode}
                            getProgressPercentage={getProgressPercentage}
                            formatProgress={formatProgress}
                            totalsSummary={totalsSummary}
                            onPatchProgress={patchProgressValue}
                            onEdit={handleEdit}
                            onShowDetails={setSelectedMedia}
                            setSearchTerm={setSearchTerm}
                          />
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {/* Section 2: Highly Recommended */}
                {sections.recommendations.length > 0 && (
                  <section className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h2 className="text-lg font-extrabold tracking-tight">Highly Recommended</h2>
                        <p className={cn("text-xs", darkMode ? "text-slate-400" : "text-slate-500")}>Critically-acclaimed items rated 8.5+ ⭐</p>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button 
                          onClick={() => scrollContainer(recommendationsRef, -320)}
                          className="carousel-nav border-slate-200 bg-white hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-900 dark:hover:bg-slate-800"
                        >
                          <ChevronLeft className="h-4 w-4" />
                        </button>
                        <button 
                          onClick={() => scrollContainer(recommendationsRef, 320)}
                          className="carousel-nav border-slate-200 bg-white hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-900 dark:hover:bg-slate-800"
                        >
                          <ChevronRight className="h-4 w-4" />
                        </button>
                      </div>
                    </div>

                    <div 
                      ref={recommendationsRef}
                      className="no-scrollbar flex snap-x snap-mandatory gap-4 overflow-x-auto pb-4 scroll-smooth"
                    >
                      {sections.recommendations.map((item) => (
                        <div key={item._id} className="w-80 shrink-0 snap-start">
                          <MediaCardComponent 
                            item={item} 
                            darkMode={darkMode}
                            getProgressPercentage={getProgressPercentage}
                            formatProgress={formatProgress}
                            totalsSummary={totalsSummary}
                            onPatchProgress={patchProgressValue}
                            onEdit={handleEdit}
                            onShowDetails={setSelectedMedia}
                            setSearchTerm={setSearchTerm}
                          />
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {/* Section 3: Shuffled Spotlights */}
                {sections.random.length > 0 && (
                  <section className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h2 className="text-lg font-extrabold tracking-tight">Random Spotlights</h2>
                        <p className={cn("text-xs", darkMode ? "text-slate-400" : "text-slate-500")}>Stochastic highlights from your collection</p>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button 
                          onClick={() => scrollContainer(randomRef, -320)}
                          className="carousel-nav border-slate-200 bg-white hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-900 dark:hover:bg-slate-800"
                        >
                          <ChevronLeft className="h-4 w-4" />
                        </button>
                        <button 
                          onClick={() => scrollContainer(randomRef, 320)}
                          className="carousel-nav border-slate-200 bg-white hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-900 dark:hover:bg-slate-800"
                        >
                          <ChevronRight className="h-4 w-4" />
                        </button>
                      </div>
                    </div>

                    <div 
                      ref={randomRef}
                      className="no-scrollbar flex snap-x snap-mandatory gap-4 overflow-x-auto pb-4 scroll-smooth"
                    >
                      {sections.random.map((item) => (
                        <div key={item._id} className="w-80 shrink-0 snap-start">
                          <MediaCardComponent 
                            item={item} 
                            darkMode={darkMode}
                            getProgressPercentage={getProgressPercentage}
                            formatProgress={formatProgress}
                            totalsSummary={totalsSummary}
                            onPatchProgress={patchProgressValue}
                            onEdit={handleEdit}
                            onShowDetails={setSelectedMedia}
                            setSearchTerm={setSearchTerm}
                          />
                        </div>
                      ))}
                    </div>
                  </section>
                )}
              </div>
            ) : (
              /* Uniform Grid View of matching results */
              <div className="space-y-4">
                <h2 className="text-lg font-extrabold tracking-tight">All Active Matching Items ({filteredMedia.length})</h2>
                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {filteredMedia.map((item) => (
                    <div key={item._id} className="fade-in-up">
                      <MediaCardComponent 
                        item={item} 
                        darkMode={darkMode}
                        getProgressPercentage={getProgressPercentage}
                        formatProgress={formatProgress}
                        totalsSummary={totalsSummary}
                        onPatchProgress={patchProgressValue}
                        onEdit={handleEdit}
                        onShowDetails={setSelectedMedia}
                        setSearchTerm={setSearchTerm}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </main>

      {/* FOOTER BAR */}
      <footer className={cn("mt-20 border-t py-8 text-center text-xs transition-colors", 
        darkMode ? "border-slate-800 bg-slate-950 text-slate-500" : "border-slate-200 bg-slate-100 text-slate-500")}>
        <div className="mx-auto max-w-7xl px-4">
          <p className="font-bold">Media Flow Database Tracker • 100% Serverless & Offline Stable</p>
          <p className="mt-1">All data is kept in your local browser storage. You can backup your database or import backups anytime.</p>
        </div>
      </footer>

      {/* SIDEBAR FOR ADDING & EDITING */}
      <div className={cn("fixed inset-0 z-40 transition-all", addOpen ? "pointer-events-auto" : "pointer-events-none")}>
        <div 
          className={cn("absolute inset-0 bg-slate-950/60 backdrop-blur-sm transition-opacity duration-300", addOpen ? "opacity-100" : "opacity-0")}
          onClick={() => {
            setAddOpen(false);
            setEditingId(null);
            setForm(defaultForm);
          }} 
        />
        <aside className={cn("absolute right-0 top-0 h-full w-full max-w-lg overflow-y-auto p-6 shadow-2xl transition-transform duration-300 ease-out", 
          addOpen ? "translate-x-0" : "translate-x-full", 
          darkMode ? "bg-slate-900 text-slate-100" : "bg-white text-slate-800")}>
          
          <div className="mb-6 flex items-center justify-between border-b pb-4 dark:border-slate-800">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-indigo-500">
                {editingId ? "Modify Existing Card" : "New Media Asset"}
              </span>
              <h3 className="text-xl font-black">{editingId ? "Edit Media Card" : "Add New Media Card"}</h3>
            </div>
            
            <button 
              onClick={() => {
                setAddOpen(false);
                setEditingId(null);
                setForm(defaultForm);
              }}
              className="rounded-full p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 dark:text-slate-500"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <form className="space-y-5" onSubmit={handleSaveSubmit}>
            
            {/* Category selection */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Media Category</label>
              <div className="grid grid-cols-3 gap-2">
                {(Object.keys(categoryLabel) as MediaCategory[]).map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => {
                      setForm((c) => ({
                        ...c,
                        category: cat,
                        seasons: ["anime", "cartoon", "series", "drama"].includes(cat)
                          ? c.seasons.length > 0 ? c.seasons : makeSeasons(c.totalSeasons)
                          : c.seasons
                      }));
                    }}
                    className={cn("rounded-xl border py-2 text-center text-xs font-semibold capitalize transition",
                      form.category === cat 
                        ? "border-indigo-500 bg-indigo-600/10 text-indigo-500" 
                        : darkMode 
                          ? "border-slate-800 bg-slate-800 text-slate-300 hover:bg-slate-700" 
                          : "border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100")}
                  >
                    {categoryLabel[cat]}
                  </button>
                ))}
              </div>
            </div>

            {/* Title */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Asset Title</label>
              <input
                required
                type="text"
                placeholder="e.g. Solo Leveling, Interstellar..."
                value={form.title}
                onChange={(e) => setForm((c) => ({ ...c, title: e.target.value }))}
                className={cn("w-full rounded-xl border px-3.5 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500", 
                  darkMode ? "border-slate-800 bg-slate-800 text-slate-100" : "border-slate-200 bg-white text-slate-800")}
              />
            </div>

            {/* Cover Image URL with quick cover presets */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-400">Cover Image URL</label>
                <span className="text-[10px] text-slate-500">Or tap a quick pick cover below</span>
              </div>
              <input
                type="url"
                placeholder="Paste any http/https cover art link..."
                value={form.coverImage}
                onChange={(e) => setForm((c) => ({ ...c, coverImage: e.target.value }))}
                className={cn("w-full rounded-xl border px-3.5 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500", 
                  darkMode ? "border-slate-800 bg-slate-800 text-slate-100" : "border-slate-200 bg-white text-slate-800")}
              />
              
              {/* Cover Art Preset list */}
              <div className="mt-2 grid grid-cols-3 gap-1.5">
                {PRESET_COVERS.map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => setForm((c) => ({ ...c, coverImage: preset.url }))}
                    className={cn("rounded-lg border py-1 px-1.5 text-left text-[10px] truncate font-medium hover:opacity-95 text-slate-400 transition",
                      form.coverImage === preset.url ? "border-indigo-500 text-indigo-500 bg-indigo-500/5" : "border-slate-800 dark:border-slate-800")}
                  >
                    🌅 {preset.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Rating Stars / Score */}
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-400">Personal Score Rating</label>
                <span className="text-sm font-bold text-yellow-500">⭐ {form.rating.toFixed(1)} / 10</span>
              </div>
              <input 
                type="range"
                min="0"
                max="10"
                step="0.1"
                value={form.rating}
                onChange={(e) => setForm((c) => ({ ...c, rating: Number(e.target.value) }))}
                className="w-full h-1.5 bg-slate-300 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-600"
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Synopsis / Personal Thoughts</label>
              <textarea
                placeholder="Write a brief overview of why you like this, where to watch, or characters..."
                value={form.description}
                onChange={(e) => setForm((c) => ({ ...c, description: e.target.value }))}
                className={cn("w-full rounded-xl border px-3.5 py-2.5 text-sm min-h-20 max-h-40 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500", 
                  darkMode ? "border-slate-800 bg-slate-800 text-slate-100" : "border-slate-200 bg-white text-slate-800")}
              />
            </div>

            {/* Genres Tag input with suggestions */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Genres (Comma separated)</label>
              <input
                type="text"
                placeholder="Fantasy, Action, Sci-Fi, Mystery..."
                value={form.genres}
                onChange={(e) => setForm((c) => ({ ...c, genres: e.target.value }))}
                className={cn("w-full rounded-xl border px-3.5 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 mb-1.5", 
                  darkMode ? "border-slate-800 bg-slate-800 text-slate-100" : "border-slate-200 bg-white text-slate-800")}
              />
              <div className="flex flex-wrap gap-1">
                {SUGGESTED_GENRES.map((gen) => {
                  const hasGenre = form.genres.toLowerCase().includes(gen.toLowerCase());
                  return (
                    <button
                      key={gen}
                      type="button"
                      onClick={() => {
                        const current = form.genres.split(",").map(g => g.trim()).filter(Boolean);
                        const isIncluded = current.some(g => g.toLowerCase() === gen.toLowerCase());
                        let nextVal = "";
                        if (isIncluded) {
                          nextVal = current.filter(g => g.toLowerCase() !== gen.toLowerCase()).join(", ");
                        } else {
                          current.push(gen);
                          nextVal = current.join(", ");
                        }
                        setForm(c => ({ ...c, genres: nextVal }));
                      }}
                      className={cn("rounded-full px-2 py-0.5 text-[9px] font-semibold transition border",
                        hasGenre 
                          ? "bg-indigo-500/20 text-indigo-500 border-indigo-500/30" 
                          : "bg-slate-100 dark:bg-slate-800 text-slate-400 border-transparent hover:border-slate-300")}
                    >
                      {hasGenre ? `✓ ${gen}` : `+ ${gen}`}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Category specific metrics */}
            <div className="rounded-2xl bg-slate-100/50 p-4 dark:bg-slate-800/50 border border-slate-200/30">
              <h4 className="text-xs font-extrabold uppercase tracking-widest text-slate-400 mb-3">Progression Counters</h4>
              
              {form.category === "manhwa" && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Current Chapter</label>
                    <input
                      type="number"
                      min="0"
                      value={form.currentChapter}
                      onChange={(e) => setForm((c) => ({ ...c, currentChapter: Number(e.target.value) }))}
                      className={cn("w-full rounded-xl border px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500",
                        darkMode ? "border-slate-800 bg-slate-800 text-white" : "border-slate-200 bg-white text-slate-800")}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Total Chapters</label>
                    <input
                      type="number"
                      min="1"
                      value={form.totalChapters}
                      onChange={(e) => setForm((c) => ({ ...c, totalChapters: Number(e.target.value) }))}
                      className={cn("w-full rounded-xl border px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500",
                        darkMode ? "border-slate-800 bg-slate-800 text-white" : "border-slate-200 bg-white text-slate-800")}
                    />
                  </div>
                </div>
              )}

              {["anime", "cartoon", "series", "drama"].includes(form.category) && (
                <div className="space-y-4">
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Episode Progress</label>
                      <input
                        type="number"
                        min="0"
                        value={form.currentEpisode}
                        onChange={(e) => setForm((c) => ({ ...c, currentEpisode: Number(e.target.value) }))}
                        className={cn("w-full rounded-xl border px-3 py-2 text-sm",
                          darkMode ? "border-slate-800 bg-slate-800 text-white" : "border-slate-200 bg-white text-slate-800")}
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Current Season</label>
                      <input
                        type="number"
                        min="1"
                        max={form.totalSeasons}
                        value={form.currentSeason}
                        onChange={(e) => setForm((c) => ({ ...c, currentSeason: clamp(Number(e.target.value), 1, c.totalSeasons) }))}
                        className={cn("w-full rounded-xl border px-3 py-2 text-sm",
                          darkMode ? "border-slate-800 bg-slate-800 text-white" : "border-slate-200 bg-white text-slate-800")}
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Total Seasons</label>
                      <input
                        type="number"
                        min="1"
                        value={form.totalSeasons}
                        onChange={(e) => handleTotalSeasonsChange(Number(e.target.value))}
                        className={cn("w-full rounded-xl border px-3 py-2 text-sm",
                          darkMode ? "border-slate-800 bg-slate-800 text-white" : "border-slate-200 bg-white text-slate-800")}
                      />
                    </div>
                  </div>

                  {/* Season Breakdown editor list */}
                  <div className="space-y-2 border-t pt-3 border-slate-200 dark:border-slate-800">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Episode counts per season</span>
                    <div className="max-h-28 overflow-y-auto space-y-1.5 pr-1">
                      {form.seasons.map((s, idx) => (
                        <div key={s.seasonNumber} className="flex items-center justify-between text-xs">
                          <span className="text-slate-400 font-medium">Season {s.seasonNumber}</span>
                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              min="1"
                              value={s.totalEpisodes}
                              onChange={(e) => {
                                const val = Math.max(Number(e.target.value), 1);
                                setForm((prev) => {
                                  const list = [...prev.seasons];
                                  list[idx] = { ...list[idx], totalEpisodes: val };
                                  return { ...prev, seasons: list };
                                });
                              }}
                              className={cn("w-16 text-center rounded-lg border py-1 px-1.5 text-xs",
                                darkMode ? "border-slate-700 bg-slate-800 text-white" : "border-slate-200 bg-white text-slate-800")}
                            />
                            <span className="text-[10px] text-slate-400">episodes</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {form.category === "book" && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Current Page</label>
                    <input
                      type="number"
                      min="0"
                      value={form.currentPage}
                      onChange={(e) => setForm((c) => ({ ...c, currentPage: Number(e.target.value) }))}
                      className={cn("w-full rounded-xl border px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500",
                        darkMode ? "border-slate-800 bg-slate-800 text-white" : "border-slate-200 bg-white text-slate-800")}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Total Pages</label>
                    <input
                      type="number"
                      min="1"
                      value={form.totalPages}
                      onChange={(e) => setForm((c) => ({ ...c, totalPages: Number(e.target.value) }))}
                      className={cn("w-full rounded-xl border px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500",
                        darkMode ? "border-slate-800 bg-slate-800 text-white" : "border-slate-200 bg-white text-slate-800")}
                    />
                  </div>
                </div>
              )}

              {form.category === "movie" && (
                <div className="space-y-3">
                  <div>
                    <div className="flex justify-between mb-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      <span>Watch Percentage</span>
                      <span className="text-indigo-500">{form.watchPercentage}%</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      step="5"
                      value={form.watchPercentage}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        setForm((c) => ({ ...c, watchPercentage: val, watched: val >= 100 }));
                      }}
                      className="w-full accent-indigo-600 h-1 bg-slate-300 rounded"
                    />
                  </div>
                  <label className="flex items-center gap-2 text-xs font-semibold text-slate-400 select-none cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.watched}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setForm((c) => ({ ...c, watched: checked, watchPercentage: checked ? 100 : c.watchPercentage }));
                      }}
                      className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 h-4 w-4"
                    />
                    <span>Mark as completely Watched</span>
                  </label>
                </div>
              )}
            </div>

            {/* Prequels & Sequels Graph Linking dropdowns */}
            <div className="space-y-3 border-t pt-4 dark:border-slate-800">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold uppercase tracking-wider text-indigo-500">Connected Media Graph</span>
                <span className="text-[10px] text-slate-400 font-medium">(Links with other cards)</span>
              </div>
              
              <MultiSelectComponent
                label="Prequels (Prior installments)"
                selected={form.prequelIds}
                options={mediaOptions.filter((opt) => opt.id !== editingId && !form.sequelIds.includes(opt.id))}
                darkMode={darkMode}
                onChange={(ids) => setForm((c) => ({ ...c, prequelIds: ids }))}
              />

              <MultiSelectComponent
                label="Sequels (Succeeding installments)"
                selected={form.sequelIds}
                options={mediaOptions.filter((opt) => opt.id !== editingId && !form.prequelIds.includes(opt.id))}
                darkMode={darkMode}
                onChange={(ids) => setForm((c) => ({ ...c, sequelIds: ids }))}
              />
            </div>

            {/* Submission buttons */}
            <div className="pt-4 border-t dark:border-slate-800 space-y-2">
              <button 
                type="submit" 
                className="w-full rounded-xl bg-indigo-600 py-3 text-sm font-bold text-white shadow-lg transition hover:bg-indigo-500"
              >
                {editingId ? "Update Asset Card" : "Publish to Local Database"}
              </button>

              {editingId && (
                <div className="rounded-xl border border-rose-500/20 bg-rose-500/5 p-3 text-center">
                  <p className="text-[11px] text-slate-400 mb-2">Danger Zone: deleting this card cannot be undone.</p>
                  
                  {deleteConfirmId === editingId ? (
                    <div className="flex gap-2 justify-center">
                      <button
                        type="button"
                        onClick={() => handleDeleteItem(editingId)}
                        className="rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-rose-500"
                      >
                        Yes, permanently delete
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteConfirmId(null)}
                        className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-400"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setDeleteConfirmId(editingId)}
                      className="inline-flex items-center gap-1 text-xs font-bold text-rose-500 hover:underline"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      <span>Delete this Card</span>
                    </button>
                  )}
                </div>
              )}
            </div>

          </form>
        </aside>
      </div>

      {/* DETAILED OVERLAY MODAL ("SHOW ALL") */}
      {selectedMedia && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
          <div className={cn("relative max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-3xl p-6 shadow-2xl border transition-all", 
            darkMode ? "bg-slate-900 text-slate-100 border-slate-800" : "bg-white text-slate-800 border-slate-200")}>
            
            {/* Close button top right */}
            <button 
              onClick={() => setSelectedMedia(null)}
              className="absolute right-4 top-4 rounded-full p-2 bg-black/40 hover:bg-black/60 text-white z-10 transition"
            >
              <X className="h-5 w-5" />
            </button>

            {/* Layout Grid */}
            <div className="flex flex-col gap-6 sm:flex-row">
              {/* Cover Column */}
              <div className="w-full sm:w-2/5 shrink-0">
                <img 
                  src={selectedMedia.coverImage} 
                  alt={selectedMedia.title} 
                  className="w-full h-72 rounded-2xl object-cover shadow-lg border border-slate-700/20" 
                  onError={(e) => {
                    e.currentTarget.src = PRESET_COVERS[0].url;
                  }}
                />

                {/* Categories Badge & Score */}
                <div className="mt-3 flex items-center justify-between px-1">
                  <span className={cn("rounded-full border px-2.5 py-0.5 text-xs font-bold tracking-wide capitalize", 
                    categoryThemeColor[selectedMedia.category])}>
                    {categoryLabel[selectedMedia.category]}
                  </span>
                  <div className="flex items-center gap-1 font-bold text-yellow-500">
                    <Star className="h-4 w-4 fill-yellow-500" />
                    <span>{selectedMedia.rating.toFixed(1)} / 10</span>
                  </div>
                </div>

                {/* Progress bar info */}
                <div className="mt-4 rounded-2xl bg-slate-100/60 dark:bg-slate-800/60 border border-slate-200/40 p-3">
                  <div className="flex items-center justify-between text-xs font-bold uppercase text-slate-400 mb-1">
                    <span>Tracker Progress</span>
                    <span className="text-indigo-500 font-extrabold">{getProgressPercentage(selectedMedia)}%</span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                    <div 
                      className="h-full rounded-full bg-indigo-500 transition-all duration-300"
                      style={{ width: `${getProgressPercentage(selectedMedia)}%` }}
                    />
                  </div>
                  <p className="mt-2 text-center text-xs font-bold text-slate-300 dark:text-slate-400">
                    {formatProgress(selectedMedia)}
                  </p>
                </div>
              </div>

              {/* Data description column */}
              <div className="flex-1 space-y-4">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.3em] text-indigo-500">Local Media Database Entry</p>
                  <h2 className="text-2xl font-black tracking-tight mt-0.5 leading-snug">{selectedMedia.title}</h2>
                  <p className="text-xs text-slate-400">Added: {new Date(selectedMedia.createdAt).toLocaleDateString()}</p>
                </div>

                <div className="flex flex-wrap gap-1">
                  {selectedMedia.genres.map((genre) => (
                    <span 
                      key={genre} 
                      onClick={() => {
                        setSearchTerm(genre);
                        setSelectedMedia(null);
                        notify(`Filtered by genre: ${genre}`);
                      }}
                      className="cursor-pointer rounded-full bg-slate-100 hover:bg-indigo-50 dark:bg-slate-800 dark:hover:bg-slate-700/80 border border-transparent dark:border-slate-800 text-slate-400 dark:text-slate-300 px-2.5 py-0.5 text-xs font-semibold transition"
                    >
                      🏷️ {genre}
                    </span>
                  ))}
                </div>

                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Synopsis & Insights</h4>
                  <p className="text-xs leading-relaxed text-slate-300 dark:text-slate-300 bg-slate-100/40 dark:bg-slate-800/40 border border-slate-200/20 rounded-xl p-3 max-h-40 overflow-y-auto">
                    {selectedMedia.description}
                  </p>
                </div>

                {/* Season-by-season breakdowns if episodic */}
                {["anime", "cartoon", "series", "drama"].includes(selectedMedia.category) && 
                  selectedMedia.progress.seasons && selectedMedia.progress.seasons.length > 0 && (
                    <div>
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Season Episode Breakdowns</h4>
                      <div className="grid grid-cols-2 gap-1.5 max-h-28 overflow-y-auto">
                        {selectedMedia.progress.seasons.map((s) => (
                          <div 
                            key={s.seasonNumber} 
                            className="flex items-center justify-between text-xs rounded-lg px-2.5 py-1 bg-slate-100/50 dark:bg-slate-800/40"
                          >
                            <span className="font-semibold text-slate-300 dark:text-slate-400">Season {s.seasonNumber}</span>
                            <span className="text-slate-400">{s.totalEpisodes} episodes</span>
                          </div>
                        ))}
                      </div>
                    </div>
                )}

                {/* WIKI-LIKE INTERACTIVE LINKED GRAPHS */}
                <div className="space-y-2 border-t pt-4 dark:border-slate-800">
                  <h4 className="text-xs font-extrabold uppercase tracking-wider text-indigo-500">Connected Wiki-Graph Relations</h4>
                  
                  {/* Prequels listing */}
                  <LinkedSectionComponent
                    label="Prequels (Watch first)"
                    ids={(links[selectedMedia._id] || { prequelIds: [] }).prequelIds}
                    mediaById={mediaById}
                    darkMode={darkMode}
                    onShowDetails={setSelectedMedia}
                  />

                  {/* Sequels listing */}
                  <LinkedSectionComponent
                    label="Sequels (Watch next)"
                    ids={(links[selectedMedia._id] || { sequelIds: [] }).sequelIds}
                    mediaById={mediaById}
                    darkMode={darkMode}
                    onShowDetails={setSelectedMedia}
                  />

                  {/* Empty state relations */}
                  {!links[selectedMedia._id]?.prequelIds?.length && !links[selectedMedia._id]?.sequelIds?.length && (
                    <p className="text-[11px] text-slate-400">This item currently has no sequel/prequel graphs mapped in local database.</p>
                  )}
                </div>
              </div>
            </div>

            {/* Lower panel buttons */}
            <div className="mt-8 flex justify-end gap-2 border-t pt-4 dark:border-slate-800">
              <button
                onClick={() => {
                  setSelectedMedia(null);
                  handleEdit(selectedMedia);
                }}
                className="rounded-xl border border-indigo-500 text-indigo-500 bg-indigo-500/5 hover:bg-indigo-500/10 px-4 py-2 text-xs font-bold transition"
              >
                Modify Data
              </button>
              <button
                onClick={() => setSelectedMedia(null)}
                className="rounded-xl bg-slate-800 px-4 py-2 text-xs font-bold text-white transition hover:bg-slate-700"
              >
                Dismiss
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}

/* ─── Media Card Component ─── */
function MediaCardComponent({
  item,
  darkMode,
  getProgressPercentage,
  formatProgress,
  totalsSummary,
  onPatchProgress,
  onEdit,
  onShowDetails,
  setSearchTerm,
}: {
  item: MediaItem;
  darkMode: boolean;
  getProgressPercentage: (item: MediaItem) => number;
  formatProgress: (item: MediaItem) => string;
  totalsSummary: (item: MediaItem) => string;
  onPatchProgress: (id: string, updates: Partial<MediaProgress>) => void;
  onEdit: (item: MediaItem) => void;
  onShowDetails: (item: MediaItem) => void;
  setSearchTerm: (term: string) => void;
}) {
  const percentage = getProgressPercentage(item);

  // Quick progression increment logic
  const handleIncrement = (e: React.MouseEvent) => {
    e.stopPropagation();
    const p = item.progress;

    if (item.category === "manhwa") {
      const current = p.currentChapter ?? 0;
      const total = p.totalChapters ?? 100;
      if (current < total) {
        onPatchProgress(item._id, { currentChapter: current + 1 });
      }
    } else if (["anime", "cartoon", "series", "drama"].includes(item.category)) {
      const currentEp = p.currentEpisode ?? 0;
      const currentSeason = p.currentSeason ?? 1;
      const seasons = p.seasons || [];
      const seasonObj = seasons.find((s) => s.seasonNumber === currentSeason);
      const seasonEpsLimit = seasonObj ? seasonObj.totalEpisodes : (p.totalEpisodes ? Math.ceil(p.totalEpisodes / (p.totalSeasons || 1)) : 12);

      if (currentEp < seasonEpsLimit) {
        onPatchProgress(item._id, { currentEpisode: currentEp + 1 });
      } else if (currentSeason < (p.totalSeasons ?? 1)) {
        // Increment season and reset ep to 1
        onPatchProgress(item._id, { currentSeason: currentSeason + 1, currentEpisode: 1 });
      }
    } else if (item.category === "book") {
      const currentPage = p.currentPage ?? 0;
      const totalPages = p.totalPages ?? 300;
      if (currentPage < totalPages) {
        onPatchProgress(item._id, { currentPage: currentPage + 1 });
      }
    } else if (item.category === "movie") {
      const currentPercentage = p.watchPercentage ?? 0;
      if (currentPercentage < 100) {
        const nextPercent = clamp(currentPercentage + 10, 0, 100);
        onPatchProgress(item._id, { watchPercentage: nextPercent, watched: nextPercent >= 100 });
      }
    }
  };

  const handleDecrement = (e: React.MouseEvent) => {
    e.stopPropagation();
    const p = item.progress;

    if (item.category === "manhwa") {
      const current = p.currentChapter ?? 0;
      if (current > 0) {
        onPatchProgress(item._id, { currentChapter: current - 1 });
      }
    } else if (["anime", "cartoon", "series", "drama"].includes(item.category)) {
      const currentEp = p.currentEpisode ?? 0;
      const currentSeason = p.currentSeason ?? 1;

      if (currentEp > 0) {
        onPatchProgress(item._id, { currentEpisode: currentEp - 1 });
      } else if (currentSeason > 1) {
        // Go back to previous season, last episode
        const seasons = p.seasons || [];
        const prevSeasonObj = seasons.find((s) => s.seasonNumber === currentSeason - 1);
        const prevSeasonMax = prevSeasonObj ? prevSeasonObj.totalEpisodes : 12;
        onPatchProgress(item._id, { currentSeason: currentSeason - 1, currentEpisode: prevSeasonMax });
      }
    } else if (item.category === "book") {
      const currentPage = p.currentPage ?? 0;
      if (currentPage > 0) {
        onPatchProgress(item._id, { currentPage: currentPage - 1 });
      }
    } else if (item.category === "movie") {
      const currentPercentage = p.watchPercentage ?? 0;
      if (currentPercentage > 0) {
        const nextPercent = clamp(currentPercentage - 10, 0, 100);
        onPatchProgress(item._id, { watchPercentage: nextPercent, watched: false });
      }
    }
  };

  const handleToggleWatched = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (item.category === "movie") {
      const wasWatched = item.progress.watched ?? false;
      onPatchProgress(item._id, { watched: !wasWatched, watchPercentage: !wasWatched ? 100 : 0 });
    } else {
      // For episodic/book/manhwa, complete it
      const isCompleted = percentage >= 100;
      if (isCompleted) {
        // Reset progress
        if (item.category === "manhwa") onPatchProgress(item._id, { currentChapter: 0 });
        if (item.category === "book") onPatchProgress(item._id, { currentPage: 0 });
        if (["anime", "cartoon", "series", "drama"].includes(item.category)) onPatchProgress(item._id, { currentSeason: 1, currentEpisode: 0 });
      } else {
        // Set to maximums
        if (item.category === "manhwa") onPatchProgress(item._id, { currentChapter: item.progress.totalChapters });
        if (item.category === "book") onPatchProgress(item._id, { currentPage: item.progress.totalPages });
        if (["anime", "cartoon", "series", "drama"].includes(item.category)) {
          const lastSeason = item.progress.totalSeasons || 1;
          const seasons = item.progress.seasons || [];
          const lastSeasonObj = seasons.find((s) => s.seasonNumber === lastSeason);
          const maxEps = lastSeasonObj ? lastSeasonObj.totalEpisodes : 12;
          onPatchProgress(item._id, { currentSeason: lastSeason, currentEpisode: maxEps });
        }
      }
    }
  };

  return (
    <article 
      onClick={() => onShowDetails(item)}
      className={cn("group cursor-pointer overflow-hidden rounded-2xl border transition-all duration-200 hover:-translate-y-1 hover:shadow-xl", 
        darkMode 
          ? "border-slate-800/80 bg-slate-900 text-slate-100 hover:border-slate-700/80" 
          : "border-slate-200 bg-white text-slate-800 hover:border-slate-300")}
    >
      {/* Cover Image Frame */}
      <div className="relative h-44 w-full overflow-hidden bg-slate-200 dark:bg-slate-800">
        <img 
          src={item.coverImage} 
          alt={item.title} 
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          onError={(e) => {
            // fallback preset
            e.currentTarget.src = PRESET_COVERS[0].url;
          }}
        />
        
        {/* Rating overlay badge */}
        <div className="absolute right-2.5 top-2.5 flex items-center gap-0.5 rounded-lg bg-black/70 px-1.5 py-0.5 text-[10px] font-bold text-yellow-400 backdrop-blur-xs">
          <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
          <span>{item.rating.toFixed(1)}</span>
        </div>

        {/* Category sticker */}
        <div className="absolute left-2.5 top-2.5">
          <span className={cn("rounded-lg px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-widest border backdrop-blur-xs shadow-sm", 
            categoryThemeColor[item.category])}>
            {categoryLabel[item.category]}
          </span>
        </div>

        {/* Completion Sticker */}
        {percentage >= 100 && (
          <div className="absolute bottom-2 right-2.5 flex items-center gap-1 rounded-full bg-emerald-500 px-2 py-0.5 text-[9px] font-bold text-white shadow">
            <span>Finished</span>
            <CheckCircle2 className="h-3 w-3" />
          </div>
        )}
      </div>

      {/* Details Box */}
      <div className="space-y-2.5 p-4">
        <div>
          <h3 className="line-clamp-1 text-sm font-bold tracking-tight group-hover:text-indigo-500 transition-colors">
            {item.title}
          </h3>
          <p className="line-clamp-1 text-[10px] text-slate-400">
            {totalsSummary(item)}
          </p>
        </div>

        {/* Short Synopsis preview */}
        <p className="line-clamp-2 text-xs text-slate-400 leading-normal min-h-8">
          {item.description}
        </p>

        {/* Clickable quick genres tag track */}
        <div className="no-scrollbar flex gap-1 overflow-x-auto">
          {item.genres.map((g) => (
            <span
              key={g}
              onClick={(e) => {
                e.stopPropagation();
                setSearchTerm(g);
              }}
              className="shrink-0 rounded-md bg-slate-100 dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-slate-700 text-slate-400 dark:text-slate-300 px-1.5 py-0.3 text-[9px] font-semibold transition"
            >
              #{g}
            </span>
          ))}
        </div>

        {/* Progress statistics & indicator track */}
        <div className="space-y-1 pt-1.5 border-t dark:border-slate-800">
          <div className="flex justify-between items-center text-[10px] font-bold text-slate-400">
            <span>{formatProgress(item)}</span>
            <span className="text-indigo-500 font-extrabold">{percentage}%</span>
          </div>

          <div className="h-1.5 w-full rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
            <div 
              className={cn("h-full rounded-full transition-all duration-300", 
                percentage >= 100 ? "bg-emerald-500" : "bg-indigo-500")}
              style={{ width: `${percentage}%` }}
            />
          </div>
        </div>

        {/* Reactive Quick Actions */}
        <div className="flex items-center justify-between pt-1" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center gap-1.5">
            <button
              onClick={handleDecrement}
              title="Decrement chapter/episode/page progress"
              className={cn("progress-btn hover:scale-105 active:scale-95 text-xs", 
                darkMode 
                  ? "border-slate-800 bg-slate-800 text-slate-200 hover:bg-slate-700" 
                  : "border-slate-200 bg-slate-100 text-slate-700 hover:bg-slate-200")}
            >
              -
            </button>
            <button
              onClick={handleIncrement}
              title="Increment chapter/episode/page progress"
              className={cn("progress-btn hover:scale-105 active:scale-95 text-xs text-indigo-500", 
                darkMode 
                  ? "border-slate-800 bg-slate-800 hover:bg-slate-700" 
                  : "border-slate-200 bg-slate-100 hover:bg-slate-200")}
            >
              +
            </button>
            <button
              onClick={handleToggleWatched}
              title="Mark fully complete / incomplete"
              className={cn("rounded-full border px-2.5 py-1 text-[10px] font-bold tracking-wider uppercase transition",
                percentage >= 100
                  ? "border-emerald-500 bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20"
                  : darkMode
                    ? "border-slate-800 text-slate-400 hover:bg-slate-800"
                    : "border-slate-200 text-slate-600 hover:bg-slate-100")}
            >
              {percentage >= 100 ? "Reset" : "Complete"}
            </button>
          </div>

          <button
            onClick={() => onEdit(item)}
            className="rounded-lg bg-indigo-600/10 hover:bg-indigo-600 px-2.5 py-1 text-[10px] font-bold text-indigo-500 hover:text-white transition"
          >
            Edit
          </button>
        </div>

      </div>
    </article>
  );
}

/* ─── Multi Select Component ─── */
function MultiSelectComponent({
  label,
  selected,
  options,
  darkMode,
  onChange,
}: {
  label: string;
  selected: string[];
  options: Array<{ id: string; title: string }>;
  darkMode: boolean;
  onChange: (ids: string[]) => void;
}) {
  const [selectValue, setSelectValue] = useState("");

  const available = options.filter((opt) => !selected.includes(opt.id));
  const titleMap = Object.fromEntries(options.map((o) => [o.id, o.title]));

  const handleAdd = () => {
    if (selectValue && !selected.includes(selectValue)) {
      onChange([...selected, selectValue]);
    }
    setSelectValue("");
  };

  const handleRemove = (id: string) => {
    onChange(selected.filter((item) => item !== id));
  };

  return (
    <div className="space-y-1.5 text-xs">
      <span className="text-slate-400 font-semibold">{label}</span>
      <div className="flex gap-2">
        <select
          value={selectValue}
          onChange={(e) => setSelectValue(e.target.value)}
          className={cn("flex-1 rounded-xl border p-2 text-xs",
            darkMode ? "border-slate-800 bg-slate-800 text-white" : "border-slate-200 bg-white text-slate-800")}
        >
          <option value="">Choose item...</option>
          {available.map((opt) => (
            <option key={opt.id} value={opt.id}>
              {opt.title}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={handleAdd}
          disabled={!selectValue}
          className={cn("rounded-xl border px-3 text-xs font-bold transition",
            darkMode 
              ? "border-slate-800 bg-slate-800 text-white hover:bg-slate-700 disabled:opacity-50" 
              : "border-slate-200 bg-slate-100 text-slate-700 hover:bg-slate-200 disabled:opacity-50")}
        >
          Add relation
        </button>
      </div>

      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pt-1">
          {selected.map((id) => (
            <span
              key={id}
              className="inline-flex items-center gap-1 rounded-full bg-indigo-500/10 dark:bg-indigo-500/20 border border-indigo-500/20 text-indigo-500 px-2.5 py-0.5 text-[10px] font-bold"
            >
              <span>🔗 {titleMap[id] || id}</span>
              <button
                type="button"
                onClick={() => handleRemove(id)}
                className="ml-1 font-black text-rose-500 hover:text-rose-700"
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── Linked Section Component ─── */
function LinkedSectionComponent({
  label,
  ids,
  mediaById,
  darkMode,
  onShowDetails,
}: {
  label: string;
  ids: string[];
  mediaById: Record<string, MediaItem>;
  darkMode: boolean;
  onShowDetails: (item: MediaItem) => void;
}) {
  const items = ids.map((id) => mediaById[id]).filter(Boolean);
  if (items.length === 0) return null;

  return (
    <div className="space-y-1.5">
      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</span>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {items.map((item) => (
          <div
            key={item._id}
            onClick={() => onShowDetails(item)}
            className={cn("flex cursor-pointer items-center gap-2.5 rounded-xl border p-2 hover:scale-[1.02] transition",
              darkMode ? "border-slate-800 bg-slate-800 hover:bg-slate-700" : "border-slate-150 bg-slate-50 hover:bg-slate-100")}
          >
            <img 
              src={item.coverImage} 
              alt={item.title} 
              className="h-10 w-10 rounded-md object-cover" 
              onError={(e) => {
                e.currentTarget.src = PRESET_COVERS[0].url;
              }}
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-bold leading-tight">{item.title}</p>
              <p className="text-[9px] capitalize text-slate-400">{categoryLabel[item.category]}</p>
            </div>
            <span className="text-indigo-500 text-xs font-bold pr-1">→</span>
          </div>
        ))}
      </div>
    </div>
  );
}
