import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { ForceGraph } from './components/ForceGraph';
import { GraphNode, GraphLink, InteractionMode, ConnectionType, Network } from './types';
import { 
  Plus, Link as LinkIcon, Users, MousePointer2, AlertCircle, Edit2, X, Save, Trash2, 
  Menu, ChevronDown, ChevronRight, Globe, Crown, FolderOpen, UserPlus,
  Briefcase, Home, Heart, Gamepad2, GraduationCap, Star, Coffee, Tag, Check, Settings,
  StickyNote, Info, Calendar, MapPin, Building2, AtSign, Smartphone
} from 'lucide-react';

const NODE_COLORS = ['#ef4444', '#f97316', '#84cc16', '#06b6d4', '#8b5cf6', '#ec4899'];
const LINK_COLOR_PALETTE = ['#94a3b8', '#64748b', '#ef4444', '#f97316', '#f59e0b', '#84cc16', '#10b981', '#06b6d4', '#3b82f6', '#6366f1', '#8b5cf6', '#d946ef', '#f43f5e'];

// Icon Mapping
const NETWORK_ICONS: { [key: string]: React.ElementType } = {
  'briefcase': Briefcase,
  'home': Home,
  'heart': Heart,
  'users': Users,
  'gamepad': Gamepad2,
  'school': GraduationCap,
  'star': Star,
  'coffee': Coffee,
  'globe': Globe
};

const ICON_KEYS = Object.keys(NETWORK_ICONS);

// Define structure for presets
type PresetType = Omit<ConnectionType, 'id'>;

interface NetworkProfile {
  id: string;
  label: string;
  types: PresetType[];
}

// Define fields available for each profile
const PROFILE_FIELDS: Record<string, string[]> = {
    'standard': ['E-Mail', 'Telefon', 'Wohnort'],
    'work': ['Firma', 'Position', 'Abteilung'],
    'family': ['Geburtstag', 'Wohnort', 'Mädchenname'],
    'social': ['Kennengelernt am', 'Gemeinsame Interessen', 'Wohnort'],
    'education': ['Einrichtung', 'Jahrgang', 'Studienfach'],
    'gaming': ['Gamertag', 'Plattform', 'Main Game']
};

// Explicit Network Profiles (Decoupled from Icons)
const NETWORK_PROFILES: NetworkProfile[] = [
  {
    id: 'standard',
    label: 'Standard',
    types: [
        { label: 'Bekannte', color: '#94a3b8' },
        { label: 'Freunde', color: '#22c55e' },
    ]
  },
  {
    id: 'work',
    label: 'Arbeit',
    types: [
      { label: 'Kollege', color: '#3b82f6' },
      { label: 'Chef', color: '#ef4444' },
      { label: 'Kunde', color: '#10b981' },
      { label: 'Partner', color: '#8b5cf6' },
    ]
  },
  {
    id: 'family',
    label: 'Familie',
    types: [
      { label: 'Partner', color: '#ec4899' },
      { label: 'Kind', color: '#84cc16' },
      { label: 'Eltern', color: '#f97316' },
      { label: 'Verwandt', color: '#94a3b8' },
    ]
  },
  {
    id: 'social',
    label: 'Dating',
    types: [
      { label: 'Partner', color: '#ef4444' },
      { label: 'Date', color: '#ec4899' },
      { label: 'Ex', color: '#64748b' },
      { label: 'Schwarm', color: '#d946ef' },
    ]
  },
  {
    id: 'education',
    label: 'Uni/Schule',
    types: [
      { label: 'Mitschüler', color: '#22c55e' },
      { label: 'Lehrer', color: '#ef4444' },
      { label: 'Mentor', color: '#8b5cf6' },
    ]
  },
  {
    id: 'gaming',
    label: 'Gaming',
    types: [
      { label: 'Teammate', color: '#3b82f6' },
      { label: 'Gegner', color: '#ef4444' },
      { label: 'Gilde', color: '#f59e0b' },
    ]
  }
];

// Hook to delay unmounting for animations
function useDelayUnmount(isMounted: boolean, delayTime: number) {
  const [shouldRender, setShouldRender] = useState(false);

  useEffect(() => {
    let timeoutId: number;
    if (isMounted && !shouldRender) {
      setShouldRender(true);
    } else if (!isMounted && shouldRender) {
      timeoutId = window.setTimeout(() => setShouldRender(false), delayTime);
    }
    return () => window.clearTimeout(timeoutId);
  }, [isMounted, delayTime, shouldRender]);

  return shouldRender;
}

// Helper to safely extract ID from a node that might be a string or an object (D3 mutation)
const getNodeId = (node: string | number | GraphNode): string => {
  if (typeof node === 'object') {
    return node.id;
  }
  return String(node);
};

function App() {
  // State: Networks (Start empty)
  const [networks, setNetworks] = useState<Network[]>([]);
  const [activeNetworkId, setActiveNetworkId] = useState<string>('');

  // Interaction State
  const [mode, setMode] = useState<InteractionMode>('select');
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  
  // Pending Link State (for the modal)
  const [pendingLink, setPendingLink] = useState<{source: string, target: string} | null>(null);
  
  // Menu State
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isConnectionTypesOpen, setIsConnectionTypesOpen] = useState(false);
  const [isNetworksOpen, setIsNetworksOpen] = useState(false);
  const [settingsOpenId, setSettingsOpenId] = useState<string | null>(null);
  
  // Connection Type Editing State (Menu)
  const [isAddingType, setIsAddingType] = useState(false);
  const [editingTypeId, setEditingTypeId] = useState<string | null>(null);
  const [typeForm, setTypeForm] = useState<{label: string, color: string}>({ label: '', color: LINK_COLOR_PALETTE[0] });

  // Network Editing State (Menu & Onboarding)
  const [isAddingNetwork, setIsAddingNetwork] = useState(false);
  const [networkForm, setNetworkForm] = useState<{name: string, centralPersonName: string, icon: string, selectedProfileIds: string[]}>({ 
    name: '', 
    centralPersonName: '',
    icon: 'briefcase',
    selectedProfileIds: ['standard']
  });

  // Node Creating/Editing State
  const [isAddingPersonModalOpen, setIsAddingPersonModalOpen] = useState(false);
  const [newPersonForm, setNewPersonForm] = useState<{name: string, connectionTypeId: string}>({ name: '', connectionTypeId: '' });
  
  const [isEditingNode, setIsEditingNode] = useState(false);
  const [nodeEditForm, setNodeEditForm] = useState<{
    name: string, 
    description: string, 
    info: Record<string, string>,
    notes: string 
  }>({ name: '', description: '', info: {}, notes: '' });

  // --- Animation Hooks ---
  const isMenuMounted = useDelayUnmount(isMenuOpen, 300);
  const isPersonModalMounted = useDelayUnmount(isAddingPersonModalOpen, 200);
  const isLinkModalMounted = useDelayUnmount(!!pendingLink, 200);
  const isProfileMounted = useDelayUnmount(!!selectedNodeId, 350);

  // --- Derived State ---
  const activeNetwork = useMemo(() => 
    networks.find(n => n.id === activeNetworkId) || networks[0], 
  [networks, activeNetworkId]);

  // Safe access to nodes/links/types only if a network exists
  const nodes = activeNetwork?.nodes || [];
  const links = activeNetwork?.links || [];
  const connectionTypes = activeNetwork?.connectionTypes || [];
  const centralNode = activeNetwork?.centralNodeId ? nodes.find(n => n.id === activeNetwork.centralNodeId) : null;

  // Selected Node Logic with caching for animation
  const selectedNode = nodes.find(n => n.id === selectedNodeId);
  const [lastSelectedNode, setLastSelectedNode] = useState<GraphNode | undefined>(undefined);

  useEffect(() => {
    if (selectedNode) {
      setLastSelectedNode(selectedNode);
    }
  }, [selectedNode]);

  // Use the cached node if we are unmounting but still visible
  const displayNode = selectedNode || (isProfileMounted ? lastSelectedNode : undefined);


  // Reset states when selection or network changes
  useEffect(() => {
    setIsEditingNode(false);
    // Reset connection type editing state when switching networks
    setIsAddingType(false);
    setEditingTypeId(null);
  }, [selectedNodeId, activeNetworkId]);

  // Helper to update the current network
  const updateCurrentNetwork = (updater: (net: Network) => Network) => {
    setNetworks(prev => prev.map(n => {
      if (n.id === activeNetworkId) {
        return updater(n);
      }
      return n;
    }));
  };
  
  // Helper to update a specific network
  const updateNetworkById = (networkId: string, updater: (net: Network) => Network) => {
    setNetworks(prev => prev.map(n => {
      if (n.id === networkId) {
        return updater(n);
      }
      return n;
    }));
  };

  // Logic to open create person modal
  const openAddPersonModal = useCallback(() => {
    // Default to the first connection type if available
    const defaultType = connectionTypes.length > 0 ? connectionTypes[0].id : '';
    setNewPersonForm({ name: '', connectionTypeId: defaultType });
    setIsAddingPersonModalOpen(true);
  }, [connectionTypes]);

  // Logic to actually create the person from the form
  const handleCreatePerson = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPersonForm.name.trim()) return;

    const id = Date.now().toString();
    const initials = newPersonForm.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() || '??';
    const randomColor = NODE_COLORS[Math.floor(Math.random() * NODE_COLORS.length)];
    
    // Create the Node
    const newNode: GraphNode = {
      id,
      name: newPersonForm.name,
      initials: initials,
      color: randomColor,
      description: 'Neue Person', 
      info: {},
      notes: '',
      x: window.innerWidth / 2 + (Math.random() - 0.5) * 50,
      y: window.innerHeight / 2 + (Math.random() - 0.5) * 50,
    };

    let newLink: GraphLink | null = null;
    
    // Create the Link to Central Node if selected and central node exists
    if (activeNetwork.centralNodeId && newPersonForm.connectionTypeId) {
        const typeConfig = connectionTypes.find(t => t.id === newPersonForm.connectionTypeId);
        if (typeConfig) {
            newLink = {
                id: `l-${Date.now()}`,
                source: activeNetwork.centralNodeId,
                target: id,
                type: typeConfig.label,
                color: typeConfig.color,
                strength: 3
            };
        }
    }

    updateCurrentNetwork(net => ({
      ...net,
      nodes: [...net.nodes, newNode],
      links: newLink ? [...net.links, newLink] : net.links
    }));

    setIsAddingPersonModalOpen(false);
    setSelectedNodeId(id);
    setMode('select');
  };

  // --- Network Management Logic ---
  const handleCreateNetwork = () => {
    if (!networkForm.name.trim() || !networkForm.centralPersonName.trim()) return;

    const newNetworkId = `net-${Date.now()}`;
    const centralNodeId = `p-${Date.now()}`;
    const initial = networkForm.centralPersonName.substring(0, 2).toUpperCase();

    const centralNode: GraphNode = {
      id: centralNodeId,
      name: networkForm.centralPersonName,
      initials: initial,
      color: NODE_COLORS[0],
      description: 'Hauptperson',
      info: {},
      notes: '',
      x: 0, // Center
      y: 0,
    };

    // 1. Gather all selected profiles
    const selectedProfilesIds = networkForm.selectedProfileIds.length > 0 
        ? networkForm.selectedProfileIds 
        : ['standard'];
    
    const selectedProfiles = NETWORK_PROFILES.filter(p => selectedProfilesIds.includes(p.id));
    
    // Fallback if filtering fails logic
    const profilesToUse = selectedProfiles.length > 0 ? selectedProfiles : [NETWORK_PROFILES[0]];

    // 2. Merge types and deduplicate by label
    const combinedTypes: PresetType[] = [];
    const seenLabels = new Set<string>();

    profilesToUse.forEach(profile => {
        profile.types.forEach(t => {
            if (!seenLabels.has(t.label)) {
                seenLabels.add(t.label);
                combinedTypes.push(t);
            }
        });
    });
    
    // 3. Convert to ConnectionType with IDs
    const initialConnectionTypes: ConnectionType[] = combinedTypes.map((p, index) => ({
      id: `type-${Date.now()}-${index}`,
      label: p.label,
      color: p.color
    }));

    const newNetwork: Network = {
      id: newNetworkId,
      name: networkForm.name,
      icon: networkForm.icon,
      centralNodeId: centralNodeId,
      nodes: [centralNode],
      links: [],
      connectionTypes: initialConnectionTypes,
      profileIds: selectedProfilesIds
    };

    setNetworks(prev => [...prev, newNetwork]);
    setActiveNetworkId(newNetworkId);
    setIsAddingNetwork(false);
    // Reset form
    setNetworkForm({ name: '', centralPersonName: '', icon: 'briefcase', selectedProfileIds: ['standard'] });
    setSelectedNodeId(null);
  };

  const handleDeleteNetwork = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (networks.length <= 1) {
        alert("Das letzte Netzwerk kann nicht gelöscht werden.");
        return;
    }
    const newNetworks = networks.filter(n => n.id !== id);
    setNetworks(newNetworks);
    if (activeNetworkId === id) {
        setActiveNetworkId(newNetworks[0].id);
    }
  };

  const setNetworkCentralNode = (networkId: string, nodeId: string) => {
    updateNetworkById(networkId, net => ({
        ...net,
        centralNodeId: nodeId
    }));
  };

  // --- Connection Type Management Logic ---
  const handleSaveType = () => {
    if (!typeForm.label.trim()) return;

    updateCurrentNetwork(net => {
      let newTypes = [...net.connectionTypes];
      let newLinks = [...net.links];

      if (editingTypeId) {
        // Update existing type
        const oldLabel = newTypes.find(t => t.id === editingTypeId)?.label;
        
        newTypes = newTypes.map(t => 
          t.id === editingTypeId ? { ...t, label: typeForm.label, color: typeForm.color } : t
        );

        // Update links that used this type
        if (oldLabel) {
           newLinks = newLinks.map(l => {
              if (l.type === oldLabel) {
                  return { ...l, type: typeForm.label, color: typeForm.color };
              }
              return l;
           });
        }
      } else {
        // Create new type
        const newType: ConnectionType = {
          id: Date.now().toString(),
          label: typeForm.label,
          color: typeForm.color
        };
        newTypes.push(newType);
      }

      return { ...net, connectionTypes: newTypes, links: newLinks };
    });

    setEditingTypeId(null);
    setIsAddingType(false);
    setTypeForm({ label: '', color: LINK_COLOR_PALETTE[0] });
  };

  const handleDeleteType = (id: string) => {
    updateCurrentNetwork(net => {
        const typeToDelete = net.connectionTypes.find(t => t.id === id);
        if (!typeToDelete) return net;
        
        const fallbackType = net.connectionTypes.find(t => t.id !== id);
        const newTypes = net.connectionTypes.filter(t => t.id !== id);
        
        // Update links to fallback
        const newLinks = net.links.map(l => 
            l.type === typeToDelete.label 
           ? { ...l, type: fallbackType?.label || 'Unknown', color: fallbackType?.color || '#ccc' }
           : l
        );

        return { ...net, connectionTypes: newTypes, links: newLinks };
    });
  };

  const startEditType = (type: ConnectionType) => {
    setEditingTypeId(type.id);
    setTypeForm({ label: type.label, color: type.color });
    setIsAddingType(false);
  };
  
  const startAddType = () => {
    setEditingTypeId(null);
    setTypeForm({ label: '', color: LINK_COLOR_PALETTE[0] });
    setIsAddingType(true);
  };

  // --- Graph Interaction Logic ---

  const handleNodeClick = useCallback((node: GraphNode) => {
    if (mode === 'select') {
      setSelectedNodeId(prev => (prev === node.id ? null : node.id));
    } else if (mode === 'connect') {
      if (selectedNodeId === null) {
        setSelectedNodeId(node.id);
      } else {
        if (selectedNodeId === node.id) {
          setSelectedNodeId(null);
          return;
        }
        // Check exists
        const exists = links.some(
          l => (getNodeId(l.source) === selectedNodeId && getNodeId(l.target) === node.id) ||
               (getNodeId(l.source) === node.id && getNodeId(l.target) === selectedNodeId)
        );

        if (!exists) {
            setPendingLink({ source: selectedNodeId, target: node.id });
        }
        setSelectedNodeId(null);
      }
    }
  }, [mode, selectedNodeId, links]);

  const confirmPendingLink = (type: ConnectionType) => {
      if (!pendingLink) return;
      const newLink: GraphLink = {
        id: `l-${Date.now()}`,
        source: pendingLink.source,
        target: pendingLink.target,
        type: type.label,
        color: type.color,
        strength: 3
      };
      
      updateCurrentNetwork(net => ({
        ...net,
        links: [...net.links, newLink]
      }));

      setPendingLink(null);
      setMode('select');
  };

  const handleBackgroundClick = useCallback(() => {
    setSelectedNodeId(null);
    setIsEditingNode(false);
    setIsMenuOpen(false);
    setPendingLink(null);
  }, []);

  // --- Node Editing ---

  const handleStartNodeEdit = () => {
    if (!displayNode) return;
    setNodeEditForm({
      name: displayNode.name,
      description: displayNode.description || '',
      info: displayNode.info || {},
      notes: displayNode.notes || ''
    });
    setIsEditingNode(true);
  };

  const handleSaveNodeEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedNodeId) return;

    updateCurrentNetwork(net => ({
        ...net,
        nodes: net.nodes.map(node => {
            if (node.id === selectedNodeId) {
                const initials = nodeEditForm.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
                return {
                  ...node,
                  name: nodeEditForm.name,
                  description: nodeEditForm.description,
                  initials: initials || node.initials,
                  info: nodeEditForm.info,
                  notes: nodeEditForm.notes
                };
            }
            return node;
        })
    }));

    setIsEditingNode(false);
  };

  const handleDeleteNode = () => {
    if (!selectedNodeId) return;
    
    updateCurrentNetwork(net => ({
        ...net,
        links: net.links.filter(l => getNodeId(l.source) !== selectedNodeId && getNodeId(l.target) !== selectedNodeId),
        nodes: net.nodes.filter(n => n.id !== selectedNodeId),
        centralNodeId: net.centralNodeId === selectedNodeId ? undefined : net.centralNodeId // Unset central if deleted
    }));

    setSelectedNodeId(null);
    setIsEditingNode(false);
  };

  const changeLinkType = (linkId: string, newTypeLabel: string) => {
    const typeConfig = connectionTypes.find(t => t.label === newTypeLabel);
    if (!typeConfig) return;

    updateCurrentNetwork(net => ({
        ...net,
        links: net.links.map(l => {
            if (l.id === linkId) {
                return { ...l, type: typeConfig.label, color: typeConfig.color };
            }
            return l;
        })
    }));
  };

  const toggleProfile = (profileId: string) => {
    setNetworkForm(prev => {
        const ids = prev.selectedProfileIds;
        if (ids.includes(profileId)) {
            return { ...prev, selectedProfileIds: ids.filter(id => id !== profileId) };
        } else {
            return { ...prev, selectedProfileIds: [...ids, profileId] };
        }
    });
  };

  // Determine active fields based on selected profiles
  const getActiveFields = () => {
     if (!activeNetwork) return [];
     const profiles = activeNetwork.profileIds || ['standard'];
     const fields = new Set<string>();
     
     // Add fields from all selected profiles
     profiles.forEach(pid => {
         const pFields = PROFILE_FIELDS[pid];
         if (pFields) {
             pFields.forEach(f => fields.add(f));
         }
     });
     
     // Always add standard if nothing else
     if (fields.size === 0) {
         PROFILE_FIELDS['standard'].forEach(f => fields.add(f));
     }

     return Array.from(fields);
  };
  
  const activeFields = getActiveFields();

  // --- UI Components ---
  const renderProfileSelector = () => (
    <div>
        <label className="block text-xs font-bold text-slate-500 uppercase mb-2 flex items-center gap-1">
            <Tag className="w-3 h-3" /> Vorlagen wählen (Mehrfachauswahl)
        </label>
        <div className="flex flex-wrap gap-2">
            {NETWORK_PROFILES.map(profile => {
                const isSelected = networkForm.selectedProfileIds.includes(profile.id);
                return (
                    <button
                        key={profile.id}
                        onClick={() => toggleProfile(profile.id)}
                        className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all flex items-center gap-1.5 ${
                            isSelected
                            ? 'bg-indigo-100 border-indigo-500 text-indigo-700 shadow-sm' 
                            : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                        }`}
                    >
                        {isSelected && <Check className="w-3 h-3" />}
                        {profile.label}
                    </button>
                );
            })}
        </div>
        {networkForm.selectedProfileIds.length === 0 && (
            <p className="text-[10px] text-amber-600 mt-1.5 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" /> Standard-Werte werden verwendet, wenn nichts gewählt ist.
            </p>
        )}
    </div>
  );

  // 1. Onboarding / Empty State
  if (networks.length === 0) {
    return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
            <div className="bg-white max-w-lg w-full rounded-2xl shadow-xl border border-slate-200 p-8 animate-zoom-in max-h-[90vh] overflow-y-auto">
                <div className="flex justify-center mb-6">
                    <div className="bg-indigo-100 p-4 rounded-full">
                        <Users className="w-10 h-10 text-indigo-600" />
                    </div>
                </div>
                <h1 className="text-2xl font-bold text-center text-slate-800 mb-2">Willkommen!</h1>
                <p className="text-center text-slate-500 mb-8">Erstelle dein erstes Beziehungsnetzwerk, um zu starten.</p>
                
                <div className="space-y-6">
                     <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Netzwerk Name</label>
                            <input 
                                type="text" 
                                placeholder="z.B. Firma GmbH"
                                value={networkForm.name}
                                onChange={(e) => setNetworkForm(prev => ({...prev, name: e.target.value}))}
                                className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all text-sm"
                                autoFocus
                            />
                        </div>
                        
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Hauptperson</label>
                            <input 
                                type="text" 
                                placeholder="Name"
                                value={networkForm.centralPersonName}
                                onChange={(e) => setNetworkForm(prev => ({...prev, centralPersonName: e.target.value}))}
                                className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all text-sm"
                            />
                        </div>
                     </div>
                     
                     {renderProfileSelector()}

                     <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Icon wählen (Optik)</label>
                        <div className="flex flex-wrap gap-2 justify-center bg-slate-50 p-3 rounded-xl border border-slate-100">
                            {ICON_KEYS.map(iconKey => {
                                const IconComp = NETWORK_ICONS[iconKey];
                                return (
                                    <button 
                                        key={iconKey}
                                        onClick={() => setNetworkForm(prev => ({...prev, icon: iconKey}))}
                                        className={`p-2.5 rounded-lg transition-all ${networkForm.icon === iconKey ? 'bg-indigo-600 text-white shadow-md' : 'bg-white text-slate-500 hover:bg-indigo-50 hover:text-indigo-600'}`}
                                    >
                                        <IconComp className="w-5 h-5" />
                                    </button>
                                );
                            })}
                        </div>
                     </div>

                     <button 
                        onClick={handleCreateNetwork}
                        disabled={!networkForm.name || !networkForm.centralPersonName}
                        className="w-full bg-indigo-600 text-white font-bold py-3.5 rounded-xl hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-indigo-200 mt-4"
                     >
                        Netzwerk erstellen
                     </button>
                </div>
            </div>
        </div>
    );
  }

  // Helper to render icon
  const ActiveIcon = NETWORK_ICONS[activeNetwork.icon] || Globe;

  return (
    <div className="flex flex-col h-screen w-screen bg-slate-100">
      
      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between shadow-sm z-10 relative">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => setIsMenuOpen(true)}
            className="p-2 -ml-2 hover:bg-slate-100 rounded-lg transition-colors text-slate-600"
          >
            <Menu className="w-6 h-6" />
          </button>
          <div className="flex items-center gap-3">
            <div className="bg-indigo-600 p-2 rounded-lg shadow-sm">
              <ActiveIcon className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-800 tracking-tight">Beziehungsnetz</h1>
              <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
                  <span>{activeNetwork.name}</span>
                  <span className="text-slate-300">•</span>
                  <span>{centralNode ? centralNode.name : 'Keine Hauptperson'}</span>
              </div>
            </div>
          </div>
        </div>
        
        <div className="text-right hidden sm:block">
           <div className="text-sm font-semibold text-slate-700">{nodes.length} Personen</div>
           <div className="text-xs text-slate-500">{links.length} Verbindungen</div>
        </div>
      </header>

      {/* Menu Sidebar */}
      {isMenuMounted && (
        <>
          <div 
             className={`fixed inset-0 bg-black/20 backdrop-blur-sm z-40 ${isMenuOpen ? 'animate-fade-in' : 'animate-fade-out'}`} 
             onClick={() => setIsMenuOpen(false)} 
          />
          <div 
             className={`fixed top-0 left-0 h-full w-80 bg-white shadow-2xl z-50 flex flex-col ${isMenuOpen ? 'animate-slide-in-left' : 'animate-slide-out-left'}`}
          >
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <h2 className="text-lg font-bold text-slate-800">Menü</h2>
              <button onClick={() => setIsMenuOpen(false)} className="p-2 hover:bg-slate-200 rounded-lg text-slate-500">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6 space-y-8">
              
              {/* Networks Section */}
              <section>
                <div 
                  className="flex items-center justify-between mb-2 cursor-pointer select-none group"
                  onClick={() => setIsNetworksOpen(!isNetworksOpen)}
                >
                  <div className="flex items-center gap-2 text-slate-800 font-semibold">
                    {isNetworksOpen ? <ChevronDown className="w-4 h-4 text-slate-400 group-hover:text-slate-600" /> : <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-slate-600" />}
                    <Globe className="w-4 h-4" />
                    <h3>Netzwerke</h3>
                  </div>
                  {!isAddingNetwork && (
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          setIsNetworksOpen(true);
                          setIsAddingNetwork(true);
                        }} 
                        className="text-xs bg-indigo-50 text-indigo-600 px-2 py-1 rounded hover:bg-indigo-100 transition-colors"
                      >
                          + Neu
                      </button>
                  )}
                </div>

                {isNetworksOpen && (
                    <div className="animate-in slide-in-from-top-2 duration-200 pl-6">
                        {isAddingNetwork ? (
                             <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3 mt-2">
                                <h4 className="text-xs font-bold text-slate-500 uppercase">Neues Netzwerk</h4>
                                <input 
                                    type="text" 
                                    placeholder="Netzwerk Name"
                                    value={networkForm.name}
                                    onChange={(e) => setNetworkForm(prev => ({...prev, name: e.target.value}))}
                                    className="w-full px-3 py-2 border rounded-lg text-sm mb-2"
                                    autoFocus
                                />
                                <input 
                                    type="text" 
                                    placeholder="Name der Hauptperson"
                                    value={networkForm.centralPersonName}
                                    onChange={(e) => setNetworkForm(prev => ({...prev, centralPersonName: e.target.value}))}
                                    className="w-full px-3 py-2 border rounded-lg text-sm mb-3"
                                />
                                
                                {renderProfileSelector()}

                                <div className="mb-3 mt-3">
                                    <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Icon</label>
                                    <div className="flex flex-wrap gap-1">
                                        {ICON_KEYS.map(iconKey => {
                                            const IconComp = NETWORK_ICONS[iconKey];
                                            return (
                                                <button 
                                                    key={iconKey}
                                                    onClick={() => setNetworkForm(prev => ({...prev, icon: iconKey}))}
                                                    className={`p-1.5 rounded-md transition-all ${networkForm.icon === iconKey ? 'bg-indigo-600 text-white' : 'bg-white border text-slate-500 hover:bg-slate-100'}`}
                                                >
                                                    <IconComp className="w-3.5 h-3.5" />
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    <button onClick={() => { setIsAddingNetwork(false); setNetworkForm({name:'', centralPersonName:'', icon: 'briefcase', selectedProfileIds: ['standard']}); }} className="flex-1 py-1.5 text-xs text-slate-500 hover:bg-slate-200 rounded">Abbrechen</button>
                                    <button onClick={handleCreateNetwork} className="flex-1 py-1.5 text-xs bg-indigo-600 text-white rounded hover:bg-indigo-700">Erstellen</button>
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-2 mt-2">
                                {networks.map(net => {
                                    const NetIcon = NETWORK_ICONS[net.icon] || Globe;
                                    const isActive = activeNetworkId === net.id;
                                    const isSettingsOpen = settingsOpenId === net.id;

                                    return (
                                        <div 
                                            key={net.id} 
                                            className={`flex flex-col p-3 rounded-xl border transition-all ${isActive ? 'bg-indigo-50 border-indigo-200 shadow-sm' : 'bg-white border-slate-100'}`}
                                        >
                                            <div 
                                                className="flex items-center justify-between cursor-pointer"
                                                onClick={() => { setActiveNetworkId(net.id); setIsMenuOpen(false); setSelectedNodeId(null); setSettingsOpenId(null); }}
                                            >
                                                <div className="flex items-center gap-3">
                                                    <div className={`${isActive ? 'text-indigo-600' : 'text-slate-400'}`}>
                                                        <NetIcon className="w-4 h-4" />
                                                    </div>
                                                    <div>
                                                        <div className={`text-sm font-semibold ${isActive ? 'text-indigo-900' : 'text-slate-700'}`}>{net.name}</div>
                                                        <div className="text-[10px] text-slate-500">{net.nodes.length} Personen</div>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-1">
                                                    <button 
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setSettingsOpenId(isSettingsOpen ? null : net.id);
                                                        }}
                                                        className={`p-1.5 rounded transition-colors ${isSettingsOpen ? 'text-indigo-600 bg-indigo-100' : 'text-slate-300 hover:text-indigo-600 hover:bg-indigo-50'}`}
                                                    >
                                                        <Settings className="w-3.5 h-3.5" />
                                                    </button>
                                                    
                                                    {networks.length > 1 && !isActive && (
                                                        <button 
                                                            onClick={(e) => handleDeleteNetwork(net.id, e)}
                                                            className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                                                        >
                                                            <Trash2 className="w-3.5 h-3.5" />
                                                        </button>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Network Settings for specific Network */}
                                            {isSettingsOpen && (
                                                <div className="mt-3 pt-3 border-t border-indigo-100 animate-in slide-in-from-top-1 cursor-default" onClick={e => e.stopPropagation()}>
                                                    <label className="text-[10px] uppercase font-bold text-indigo-400 mb-1 flex items-center gap-1.5">
                                                        <Crown className="w-3 h-3" />
                                                        Hauptperson ändern
                                                    </label>
                                                    <select
                                                        value={net.centralNodeId || ''}
                                                        onChange={(e) => setNetworkCentralNode(net.id, e.target.value)}
                                                        className="w-full text-xs p-2 rounded-lg border border-indigo-200 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                                                    >
                                                        <option value="" disabled>Bitte wählen...</option>
                                                        {net.nodes.map(node => (
                                                            <option key={node.id} value={node.id}>
                                                                {node.name}
                                                            </option>
                                                        ))}
                                                    </select>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                )}
              </section>

              {/* Connection Types Section */}
              <section>
                <div 
                  className="flex items-center justify-between mb-2 cursor-pointer select-none group"
                  onClick={() => setIsConnectionTypesOpen(!isConnectionTypesOpen)}
                >
                  <div className="flex items-center gap-2 text-slate-800 font-semibold">
                    {isConnectionTypesOpen ? <ChevronDown className="w-4 h-4 text-slate-400 group-hover:text-slate-600" /> : <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-slate-600" />}
                    <LinkIcon className="w-4 h-4" />
                    <h3>Verbindungstypen</h3>
                  </div>
                  {!isAddingType && !editingTypeId && (
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          setIsConnectionTypesOpen(true);
                          startAddType();
                        }} 
                        className="text-xs bg-indigo-50 text-indigo-600 px-2 py-1 rounded hover:bg-indigo-100 transition-colors"
                      >
                          + Neu
                      </button>
                  )}
                </div>

                {/* List or Edit Form */}
                {isConnectionTypesOpen && (
                  <div className="animate-in slide-in-from-top-2 duration-200 pl-6">
                    {isAddingType || editingTypeId ? (
                        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3 mt-2">
                            <h4 className="text-xs font-bold text-slate-500 uppercase">{isAddingType ? 'Neuer Typ' : 'Typ bearbeiten'}</h4>
                            <input 
                                type="text" 
                                placeholder="Bezeichnung (z.B. Familie)"
                                value={typeForm.label}
                                onChange={(e) => setTypeForm(prev => ({...prev, label: e.target.value}))}
                                className="w-full px-3 py-2 border rounded-lg text-sm"
                            />
                            <div>
                                <label className="text-xs text-slate-500 block mb-1">Farbe</label>
                                <div className="flex flex-wrap gap-2">
                                    {LINK_COLOR_PALETTE.map(c => (
                                        <button
                                            key={c}
                                            onClick={() => setTypeForm(prev => ({...prev, color: c}))}
                                            className={`w-6 h-6 rounded-full border-2 ${typeForm.color === c ? 'border-slate-600 scale-110' : 'border-transparent'}`}
                                            style={{ backgroundColor: c }}
                                        />
                                    ))}
                                </div>
                            </div>
                            <div className="flex gap-2">
                                <button onClick={() => { setIsAddingType(false); setEditingTypeId(null); }} className="flex-1 py-1.5 text-xs text-slate-500 hover:bg-slate-200 rounded">Abbrechen</button>
                                <button onClick={handleSaveType} className="flex-1 py-1.5 text-xs bg-indigo-600 text-white rounded hover:bg-indigo-700">Speichern</button>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-2 mt-2">
                        {connectionTypes.length === 0 ? (
                           <div className="text-xs text-slate-400 italic">Keine Typen definiert</div>
                        ) : (
                            connectionTypes.map((type) => (
                                <div key={type.id} className="flex items-center justify-between p-3 rounded-xl border border-slate-100 bg-white hover:border-indigo-100 transition-colors group">
                                    <div className="flex items-center gap-3">
                                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: type.color }}></div>
                                        <span className="font-medium text-slate-700 text-sm">{type.label}</span>
                                    </div>
                                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button onClick={() => startEditType(type)} className="p-1 text-slate-400 hover:text-indigo-600">
                                            <Edit2 className="w-3.5 h-3.5" />
                                        </button>
                                        {connectionTypes.length > 1 && (
                                            <button onClick={() => handleDeleteType(type.id)} className="p-1 text-slate-400 hover:text-red-500">
                                                <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))
                        )}
                        </div>
                    )}
                  </div>
                )}
              </section>
            </div>
          </div>
        </>
      )}

      {/* Main Graph Area */}
      <main className="flex-1 relative overflow-hidden">
        <ForceGraph 
          nodes={nodes}
          links={links}
          mode={mode}
          selectedNodeId={selectedNodeId}
          centralNodeId={activeNetwork.centralNodeId}
          onNodeClick={handleNodeClick}
          onBackgroundClick={handleBackgroundClick}
        />

        {/* Floating Controls */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-white/95 backdrop-blur shadow-xl border border-slate-200 p-2 rounded-2xl z-20 transition-all">
          <button
            onClick={() => { setMode('select'); setSelectedNodeId(null); }}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all ${mode === 'select' ? 'bg-slate-800 text-white shadow-md scale-105' : 'bg-transparent text-slate-600 hover:bg-slate-100'}`}
          >
            <MousePointer2 className="w-4 h-4" /> <span>Auswählen</span>
          </button>
          <div className="w-px h-6 bg-slate-200 mx-1"></div>
          <button
            onClick={() => { setMode('connect'); setSelectedNodeId(null); }}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all ${mode === 'connect' ? 'bg-indigo-600 text-white shadow-md scale-105' : 'bg-transparent text-slate-600 hover:bg-slate-100'}`}
          >
            <LinkIcon className="w-4 h-4" /> <span>Verbinden</span>
          </button>
          <div className="w-px h-6 bg-slate-200 mx-1"></div>
          <button
            onClick={openAddPersonModal}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-emerald-500 text-white shadow-md hover:bg-emerald-600 active:scale-95 transition-all"
          >
            <Plus className="w-4 h-4" /> <span>Person</span>
          </button>
        </div>

        {/* Connect Mode Hint */}
        {mode === 'connect' && !pendingLink && (
          <div className="absolute top-6 left-1/2 -translate-x-1/2 bg-indigo-600 text-white px-4 py-2 rounded-full shadow-lg flex items-center gap-2 pointer-events-none animate-in fade-in slide-in-from-top-4">
             <AlertCircle className="w-4 h-4" />
             <span className="text-sm font-medium">{selectedNodeId ? "Wähle eine zweite Person" : "Wähle die erste Person aus"}</span>
          </div>
        )}

        {/* Create Person Modal */}
        {isPersonModalMounted && (
            <div className={`absolute inset-0 bg-black/20 backdrop-blur-sm z-50 flex items-center justify-center ${isAddingPersonModalOpen ? 'animate-fade-in' : 'animate-fade-out'}`}>
                <div className={`bg-white p-6 rounded-2xl shadow-2xl max-w-sm w-full mx-4 border border-slate-200 ${isAddingPersonModalOpen ? 'animate-zoom-in' : 'animate-zoom-out'}`}>
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                            <UserPlus className="w-5 h-5 text-indigo-600" />
                            Neue Person erstellen
                        </h3>
                        <button onClick={() => setIsAddingPersonModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                    <form onSubmit={handleCreatePerson} className="space-y-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Name <span className="text-red-500">*</span></label>
                            <input 
                                type="text" 
                                placeholder="z.B. Maria Müller"
                                value={newPersonForm.name}
                                onChange={(e) => setNewPersonForm(prev => ({...prev, name: e.target.value}))}
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                autoFocus
                            />
                        </div>
                        {centralNode ? (
                             <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">
                                    Verbindung zu <span className="text-indigo-600">{centralNode.name}</span>
                                </label>
                                <div className="grid grid-cols-1 gap-2 max-h-40 overflow-y-auto pr-1">
                                    {connectionTypes.map(t => (
                                        <button 
                                            key={t.id}
                                            type="button"
                                            onClick={() => setNewPersonForm(prev => ({...prev, connectionTypeId: t.id}))}
                                            className={`flex items-center gap-3 p-2.5 rounded-xl border transition-all text-left ${newPersonForm.connectionTypeId === t.id ? 'border-indigo-500 bg-indigo-50 ring-1 ring-indigo-500' : 'border-slate-200 hover:border-slate-300'}`}
                                        >
                                            <div className="w-4 h-4 rounded-full shadow-sm flex-none" style={{ backgroundColor: t.color }}></div>
                                            <span className={`font-semibold text-sm ${newPersonForm.connectionTypeId === t.id ? 'text-indigo-900' : 'text-slate-700'}`}>{t.label}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        ) : (
                            <p className="text-xs text-amber-600 bg-amber-50 p-2 rounded">
                                Hinweis: Keine Hauptperson in diesem Netzwerk definiert. Es wird keine automatische Verbindung erstellt.
                            </p>
                        )}
                        
                        <div className="flex gap-2 pt-2">
                            <button type="button" onClick={() => setIsAddingPersonModalOpen(false)} className="flex-1 py-2.5 text-sm font-semibold text-slate-500 hover:bg-slate-100 rounded-lg transition-colors">
                                Abbrechen
                            </button>
                            <button type="submit" className="flex-1 py-2.5 text-sm font-semibold bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 shadow-sm transition-colors">
                                Erstellen
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        )}

        {/* Pending Link Selection Modal */}
        {isLinkModalMounted && (
            <div className={`absolute inset-0 bg-black/20 backdrop-blur-sm z-50 flex items-center justify-center ${pendingLink ? 'animate-fade-in' : 'animate-fade-out'}`}>
                <div className={`bg-white p-6 rounded-2xl shadow-2xl max-w-sm w-full mx-4 border border-slate-200 ${pendingLink ? 'animate-zoom-in' : 'animate-zoom-out'}`}>
                    <h3 className="text-lg font-bold text-slate-800 mb-2">Verbindungstyp wählen</h3>
                    <p className="text-sm text-slate-500 mb-4">Wie stehen diese Personen zueinander?</p>
                    <div className="grid grid-cols-1 gap-2">
                        {connectionTypes.map(t => (
                            <button 
                                key={t.id}
                                onClick={() => confirmPendingLink(t)}
                                className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 hover:border-indigo-500 hover:bg-indigo-50 transition-all text-left"
                            >
                                <div className="w-4 h-4 rounded-full shadow-sm" style={{ backgroundColor: t.color }}></div>
                                <span className="font-semibold text-slate-700">{t.label}</span>
                            </button>
                        ))}
                    </div>
                    <button 
                        onClick={() => setPendingLink(null)}
                        className="mt-4 w-full py-2.5 text-sm font-semibold text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
                    >
                        Abbrechen
                    </button>
                </div>
            </div>
        )}

        {/* Edit Node Dialog / Info Card */}
        {isProfileMounted && displayNode && mode === 'select' && (
          <div 
             className={`absolute top-2 right-2 bottom-2 sm:bottom-auto sm:top-6 sm:right-6 w-[calc(100vw-1rem)] sm:w-96 bg-white/95 backdrop-blur border border-slate-200 shadow-xl rounded-xl p-0 z-30 flex flex-col sm:max-h-[calc(100vh-3rem)] overflow-hidden
             ${selectedNodeId ? 'animate-slide-in-up sm:animate-slide-in-right' : 'animate-slide-out-down sm:animate-slide-out-right'}`}
          >
             {!isEditingNode ? (
               <>
                 <div className="p-4 border-b border-slate-100 flex-none">
                    <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-3">
                            <div className={`w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg shadow-sm ${activeNetwork.centralNodeId === displayNode.id ? 'ring-4 ring-yellow-400' : ''}`} style={{ backgroundColor: displayNode.color }}>
                            {displayNode.initials}
                            </div>
                            <div>
                            <h3 className="font-bold text-slate-800 text-lg leading-tight flex items-center gap-1">
                                {displayNode.name}
                                {activeNetwork.centralNodeId === displayNode.id && <Crown className="w-3 h-3 text-yellow-500 fill-yellow-500" />}
                            </h3>
                            <p className="text-sm text-slate-500 font-medium mt-0.5">{displayNode.description || "Keine Beschreibung"}</p>
                            </div>
                        </div>
                        <button onClick={() => setSelectedNodeId(null)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
                    </div>
                    <div className="flex gap-2">
                        <button onClick={handleStartNodeEdit} className="flex-1 flex items-center justify-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 py-1.5 px-3 rounded-lg text-xs font-semibold transition-colors">
                        <Edit2 className="w-3 h-3" /> Bearbeiten
                        </button>
                        <button onClick={handleDeleteNode} className="flex-none flex items-center justify-center gap-2 bg-red-50 hover:bg-red-100 text-red-600 py-1.5 px-3 rounded-lg text-xs font-semibold transition-colors">
                        <Trash2 className="w-3 h-3" />
                        </button>
                    </div>
                 </div>

                 <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0 custom-scrollbar">
                     {/* Info Section */}
                     <div className="space-y-3">
                        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                            <Info className="w-3 h-3" /> Informationen
                        </h4>
                        
                        <div className="grid grid-cols-1 gap-3">
                            {/* Dynamically render filled fields based on available fields + saved info */}
                            {activeFields.map(field => {
                                const value = displayNode.info?.[field];
                                if (!value) return null;
                                
                                let Icon = Tag;
                                if (field.includes('Mail')) Icon = AtSign;
                                else if (field.includes('Telefon')) Icon = Smartphone;
                                else if (field.includes('Wohnort') || field.includes('Stadt')) Icon = MapPin;
                                else if (field.includes('Firma') || field.includes('Einrichtung')) Icon = Building2;
                                else if (field.includes('Geburtstag') || field.includes('am')) Icon = Calendar;

                                return (
                                    <div key={field} className="flex items-center gap-3 text-sm">
                                        <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center text-slate-400 flex-none">
                                            <Icon className="w-4 h-4" />
                                        </div>
                                        <div>
                                            <div className="text-[10px] text-slate-400 uppercase font-bold">{field}</div>
                                            <div className="text-slate-700 font-medium">{value}</div>
                                        </div>
                                    </div>
                                );
                            })}
                            
                            {/* Fallback if no info exists */}
                            {(!displayNode.info || Object.values(displayNode.info).every(v => !v)) && (
                                <p className="text-xs text-slate-400 italic pl-1">Keine weiteren Informationen hinterlegt.</p>
                            )}
                        </div>
                     </div>

                    {/* Notes Section */}
                    {displayNode.notes && (
                         <div className="space-y-2 pt-2 border-t border-slate-100">
                             <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                                <StickyNote className="w-3 h-3" /> Notizen
                            </h4>
                            <div className="bg-amber-50 p-3 rounded-lg border border-amber-100 text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">
                                {displayNode.notes}
                            </div>
                         </div>
                    )}

                    {/* Connections Section */}
                    <div className="space-y-2 pt-2 border-t border-slate-100">
                        <div className="flex justify-between items-center">
                            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                                <LinkIcon className="w-3 h-3" /> Verbindungen
                            </div>
                            <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 rounded-full">
                            {links.filter(l => getNodeId(l.source) === displayNode.id || getNodeId(l.target) === displayNode.id).length}
                            </span>
                        </div>
                        
                        <div className="space-y-1.5">
                            {links.filter(l => getNodeId(l.source) === displayNode.id || getNodeId(l.target) === displayNode.id).length === 0 ? (
                            <p className="text-xs text-slate-400 italic pl-1">Keine Verbindungen</p>
                            ) : (
                                links.filter(l => getNodeId(l.source) === displayNode.id || getNodeId(l.target) === displayNode.id).map(l => {
                                    const sourceId = getNodeId(l.source);
                                    const otherId = sourceId === displayNode.id ? getNodeId(l.target) : sourceId;
                                    const otherNode = nodes.find(n => n.id === otherId);
                                    if (!otherNode) return null;

                                    return (
                                        <div key={l.id} className="text-sm flex items-center justify-between text-slate-600 bg-slate-50 p-2 rounded-lg border border-slate-100 hover:bg-slate-100 transition-colors group">
                                        <div className="flex items-center gap-2">
                                            <div className="w-2 h-2 rounded-full" style={{backgroundColor: otherNode.color}}></div>
                                            <span className="truncate max-w-[120px]">{otherNode.name}</span>
                                        </div>
                                        <select 
                                            value={l.type}
                                            onChange={(e) => changeLinkType(l.id, e.target.value)}
                                            className="text-[10px] py-0.5 pl-1 pr-0 rounded border border-slate-200 bg-white focus:ring-1 focus:ring-indigo-500 outline-none cursor-pointer max-w-[100px]"
                                            style={{ color: l.color, fontWeight: 600 }}
                                        >
                                            {connectionTypes.map(t => (
                                                <option key={t.id} value={t.label}>{t.label}</option>
                                            ))}
                                        </select>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>
                 </div>
               </>
             ) : (
               <form onSubmit={handleSaveNodeEdit} className="flex flex-col h-full overflow-hidden">
                 <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50 flex-none">
                   <h3 className="font-bold text-slate-800">Person bearbeiten</h3>
                   <button type="button" onClick={() => setIsEditingNode(false)} className="text-slate-400 hover:text-slate-600"><X className="w-4 h-4" /></button>
                 </div>
                 
                 <div className="flex-1 overflow-y-auto p-4 space-y-5 min-h-0 custom-scrollbar">
                    {/* Basic Info */}
                    <div className="space-y-3">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Name</label>
                            <input type="text" value={nodeEditForm.name} onChange={e => setNodeEditForm(prev => ({...prev, name: e.target.value}))} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" autoFocus />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Kurzbeschreibung</label>
                            <input type="text" value={nodeEditForm.description} onChange={e => setNodeEditForm(prev => ({...prev, description: e.target.value}))} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                        </div>
                    </div>

                    {/* Dynamic Fields */}
                    {activeFields.length > 0 && (
                        <div className="space-y-3 border-t border-slate-200 pt-3">
                            <h4 className="text-xs font-bold text-indigo-500 uppercase tracking-wider flex items-center gap-1.5">
                                <Info className="w-3 h-3" /> Details
                            </h4>
                            <div className="grid grid-cols-1 gap-3">
                                {activeFields.map(field => (
                                    <div key={field}>
                                        <label className="block text-xs font-semibold text-slate-500 mb-1">{field}</label>
                                        <input 
                                            type="text" 
                                            value={nodeEditForm.info[field] || ''} 
                                            onChange={e => setNodeEditForm(prev => ({
                                                ...prev, 
                                                info: { ...prev.info, [field]: e.target.value }
                                            }))} 
                                            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50 focus:bg-white transition-colors" 
                                        />
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Notes */}
                    <div className="space-y-3 border-t border-slate-200 pt-3">
                         <h4 className="text-xs font-bold text-amber-500 uppercase tracking-wider flex items-center gap-1.5">
                                <StickyNote className="w-3 h-3" /> Notizen
                         </h4>
                         <textarea 
                            rows={4}
                            value={nodeEditForm.notes}
                            onChange={e => setNodeEditForm(prev => ({...prev, notes: e.target.value}))}
                            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 bg-amber-50/50 focus:bg-white transition-colors resize-none"
                            placeholder="Zusätzliche Notizen hier..."
                         />
                    </div>
                 </div>

                 <div className="p-4 border-t border-slate-100 bg-white flex-none">
                    <div className="flex gap-2">
                        <button type="button" onClick={() => setIsEditingNode(false)} className="flex-1 py-2.5 rounded-lg text-sm font-semibold text-slate-600 hover:bg-slate-100 transition-colors">Abbrechen</button>
                        <button type="submit" className="flex-1 py-2.5 rounded-lg text-sm font-semibold bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm flex items-center justify-center gap-2 transition-colors"><Save className="w-3 h-3" /> Speichern</button>
                    </div>
                 </div>
               </form>
             )}
           </div>
        )}
      </main>
    </div>
  );
}

export default App;