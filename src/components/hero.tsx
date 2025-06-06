"use client"
import React, { useMemo, useRef, useState, useEffect } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useTexture } from '@react-three/drei';
import * as THREE from 'three';
import { Settings, X, Upload, RotateCcw, Image, Palette, Sliders } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";


const TEXTURE_SETS = {
    face: {
        texture: 'https://i.postimg.cc/XYwvXN8D/img-4.png',
        depthMap: 'https://i.postimg.cc/2SHKQh2q/raw-4.webp',
        name: 'Face Scan',
        scale: [3, 3, 1],
        geometry: 'plane'
    },
    custom1: {
        texture: '/sample_imgs/image1.png',
        depthMap: '/sample_imgs/image1.png',
        name: 'Custom Object',
        scale: [2.5, 2.5, 1],
        geometry: 'plane'
    },
    sphere: {
        texture: '/sample_imgs/image.png',
        depthMap: '/sample_imgs/image.png',
        name: 'Sphere Scan',
        scale: [1, 1, 1],
        geometry: 'sphere'
    }
};

const themes = {
    cyberpunk: {
        name: 'Cyberpunk',
        scanColor: [1, 0, 0],
        textColor: 'text-red-400',
        bgGradient: 'from-black via-gray-900 to-red-900',
        title: 'NEURAL LINK',
        subtitle: 'Connection established. Accessing mainframe...',
        bloomStrength: 1.2,
        scanSpeed: 0.5,
        glitchIntensity: 0.07
    },
    matrix: {
        name: 'Matrix',
        scanColor: [0, 1, 0],
        textColor: 'text-green-400',
        bgGradient: 'from-black via-gray-900 to-green-900',
        title: 'THE MATRIX',
        subtitle: 'Wake up, Neo. Follow the white rabbit.',
        bloomStrength: 1.5,
        scanSpeed: 0.3,
        glitchIntensity: 0.1
    },
    neon: {
        name: 'Neon',
        scanColor: [0, 1, 1],
        textColor: 'text-cyan-400',
        bgGradient: 'from-black via-purple-900 to-cyan-900',
        title: 'NEON DREAMS',
        subtitle: 'Synthwave aesthetic. Retro-futuristic vibes.',
        bloomStrength: 2.0,
        scanSpeed: 0.4,
        glitchIntensity: 0.05
    },
    plasma: {
        name: 'Plasma',
        scanColor: [1, 0, 1],
        textColor: 'text-fuchsia-400',
        bgGradient: 'from-black via-purple-900 to-fuchsia-900',
        title: 'PLASMA CORE',
        subtitle: 'High-energy particle acceleration in progress.',
        bloomStrength: 1.8,
        scanSpeed: 0.6,
        glitchIntensity: 0.08
    },
    arctic: {
        name: 'Arctic',
        scanColor: [0.3, 0.7, 1],
        textColor: 'text-blue-300',
        bgGradient: 'from-gray-900 via-blue-900 to-cyan-900',
        title: 'ARCTIC SCAN',
        subtitle: 'Cryogenic systems online. Temperature stable.',
        bloomStrength: 1.0,
        scanSpeed: 0.25,
        glitchIntensity: 0.03
    },
    fire: {
        name: 'Fire',
        scanColor: [1, 0.3, 0],
        textColor: 'text-orange-400',
        bgGradient: 'from-black via-red-900 to-orange-900',
        title: 'INFERNO MODE',
        subtitle: 'Thermal overload detected. System critical.',
        bloomStrength: 2.2,
        scanSpeed: 0.8,
        glitchIntensity: 0.12
    }
};

const GEOMETRY_TYPES = {
    plane: {
        name: 'Plane',
        defaultArgs: [1, 1, 64, 64],
        argLabels: ['Width', 'Height', 'Width Segments', 'Height Segments']
    },
    sphere: {
        name: 'Sphere',
        defaultArgs: [1, 32, 32],
        argLabels: ['Radius', 'Width Segments', 'Height Segments']
    },
    box: {
        name: 'Box',
        defaultArgs: [1, 1, 1],
        argLabels: ['Width', 'Height', 'Depth']
    },
    cylinder: {
        name: 'Cylinder',
        defaultArgs: [1, 1, 2, 32],
        argLabels: ['Top Radius', 'Bottom Radius', 'Height', 'Radial Segments']
    },
    torus: {
        name: 'Torus',
        defaultArgs: [1, 0.4, 16, 32],
        argLabels: ['Radius', 'Tube', 'Radial Segments', 'Tubular Segments']
    },
    cone: {
        name: 'Cone',
        defaultArgs: [1, 2, 32],
        argLabels: ['Radius', 'Height', 'Radial Segments']
    }
};

const vertexShader = `
  varying vec2 vUv;
  varying vec3 vPosition;
  void main() {
    vUv = uv;
    vPosition = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fragmentShader = `
  uniform sampler2D uTexture;
  uniform sampler2D uDepthMap;
  uniform vec2 uPointer;
  uniform float uProgress;
  uniform vec3 uScanColor;
  uniform float uTime;
  uniform float uScanMode;
  varying vec2 vUv;
  varying vec3 vPosition;

  float noise(vec2 st) {
    return fract(sin(dot(st.xy, vec2(12.9898,78.233))) * 43758.5453123);
  }

  void main() {
    vec2 uv = vUv;
    float depth = texture2D(uDepthMap, uv).r;
    vec2 offset = texture2D(uDepthMap, uv).rg * uPointer * 0.02;
    vec4 texColor = texture2D(uTexture, uv + offset);
    float alpha = texColor.a;
    float scanPos = uProgress;
    float scanDistance;
    
    if (uScanMode < 0.5) {
      scanDistance = abs(uv.y - scanPos);
    } else if (uScanMode < 1.5) {
      scanDistance = abs(uv.x - scanPos);
    } else {
      vec2 center = vec2(0.5, 0.5);
      float radius = distance(uv, center);
      scanDistance = abs(radius - scanPos * 0.7);
    }
    
    float scanWidth = 0.05;
    float scanLine = 1.0 - smoothstep(0.0, scanWidth, scanDistance);
    vec2 gridUv = uv * 80.0;
    float grid = step(0.98, fract(gridUv.x)) + step(0.98, fract(gridUv.y));
    float noisePattern = noise(uv * 150.0 + uTime);
    float dotPattern = step(0.5, noisePattern) * 0.3;
    float scanMask = smoothstep(0.0, 0.02, abs(depth - uProgress));
    scanMask = 1.0 - scanMask;
    
    vec3 scanEffect = uScanColor * scanMask * 2.0;
    vec3 gridEffect = uScanColor * grid * 0.3;
    vec3 dotEffect = uScanColor * dotPattern * scanMask;
    vec3 finalColor = texColor.rgb + scanEffect + gridEffect + dotEffect;
    float glow = scanLine * 0.5;
    finalColor += uScanColor * glow;
    float effectAlpha = scanMask * 0.8 + grid * 0.2 + glow * 0.5;
    float finalAlpha = alpha + effectAlpha;
    
    gl_FragColor = vec4(finalColor, finalAlpha);
  }
`;

const GeometryComponent = ({ geometryType, args = [] }) => {
    const defaultArgs = GEOMETRY_TYPES[geometryType]?.defaultArgs || [1, 1, 64, 64];
    const finalArgs = args.length ? args : defaultArgs;

    switch (geometryType) {
        case 'sphere': return <sphereGeometry args={finalArgs} />;
        case 'box': return <boxGeometry args={finalArgs} />;
        case 'cylinder': return <cylinderGeometry args={finalArgs} />;
        case 'torus': return <torusGeometry args={finalArgs} />;
        case 'cone': return <coneGeometry args={finalArgs} />;
        case 'plane':
        default: return <planeGeometry args={finalArgs} />;
    }
};

const Scene = ({
    theme,
    textureSet,
    scanMode = 0,
    customTextures = null,
    objectConfig,
    autoRotate = true
}) => {
    const meshRef = useRef();
    const materialRef = useRef();
    const [texturesLoaded, setTexturesLoaded] = useState(false);
    const themeConfig = themes[theme];

    const currentSet = customTextures || TEXTURE_SETS[textureSet] || TEXTURE_SETS.face;

    const [rawMap, depthMap] = useTexture(
        [currentSet.texture, currentSet.depthMap],
        (textures) => {
            console.log('Textures loaded:', textures);
            setTexturesLoaded(true);
        }
    );

    const material = useMemo(() => {
        if (!rawMap || !depthMap) return null;

        return new THREE.ShaderMaterial({
            uniforms: {
                uTexture: { value: rawMap },
                uDepthMap: { value: depthMap },
                uPointer: { value: new THREE.Vector2(0, 0) },
                uProgress: { value: 0 },
                uScanColor: { value: new THREE.Vector3(...themeConfig.scanColor) },
                uTime: { value: 0 },
                uScanMode: { value: scanMode }
            },
            vertexShader,
            fragmentShader,
            transparent: true,
            side: THREE.DoubleSide
        });
    }, [rawMap, depthMap, themeConfig.scanColor, scanMode]);

    useFrame(({ clock, pointer }) => {
        if (!materialRef.current) return;

        const uniforms = materialRef.current.uniforms;
        uniforms.uProgress.value = (Math.sin(clock.getElapsedTime() * themeConfig.scanSpeed) * 0.5 + 0.5);
        uniforms.uPointer.value.set(pointer.x, pointer.y);
        uniforms.uTime.value = clock.getElapsedTime();

        if (meshRef.current && autoRotate) {
            meshRef.current.rotation.y = clock.getElapsedTime() * 0.2;
        }
    });

    if (!material) {
        return (
            <mesh>
                <planeGeometry args={[2, 2]} />
                <meshBasicMaterial color="red" />
            </mesh>
        );
    }

    return (
        <mesh ref={meshRef} scale={objectConfig.scale}>
            <GeometryComponent
                geometryType={objectConfig.geometry}
                args={objectConfig.geometryArgs}
            />
            <primitive object={material} ref={materialRef} />
        </mesh>
    );
};

const PopupControls = ({
    isOpen,
    onClose,
    currentTheme,
    onThemeChange,
    currentTextureSet,
    onTextureSetChange,
    scanMode,
    onScanModeChange,
    onCustomTexture,
    customTitle,
    setCustomTitle,
    customSubtitle,
    setCustomSubtitle,
    objectConfig,
    setObjectConfig,
    autoRotate,
    setAutoRotate,
    themeConfig
}) => {
    const [showCustomForm, setShowCustomForm] = useState(false);
    const [customTexture, setCustomTexture] = useState('');
    const [customDepthMap, setCustomDepthMap] = useState('');
    const [localState, setLocalState] = useState({
        theme: currentTheme,
        textureSet: currentTextureSet,
        scanMode,
        customTitle,
        customSubtitle,
        objectConfig: { ...objectConfig },
        autoRotate
    });

    // Update local state when props change
    useEffect(() => {
        if (isOpen) {
            setLocalState({
                theme: currentTheme,
                textureSet: currentTextureSet,
                scanMode,
                customTitle,
                customSubtitle,
                objectConfig: { ...objectConfig },
                autoRotate
            });
        }
    }, [isOpen, currentTheme, currentTextureSet, scanMode, customTitle, customSubtitle, objectConfig, autoRotate]);

    const handleCustomSubmit = (e) => {
        e.preventDefault();
        if (customTexture && customDepthMap) {
            onCustomTexture({
                texture: customTexture,
                depthMap: customDepthMap,
                name: 'Custom',
                scale: localState.objectConfig.scale,
                geometry: localState.objectConfig.geometry
            });
            setShowCustomForm(false);
        }
    };

    const handleScaleChange = (axis, value) => {
        const newScale = [...localState.objectConfig.scale];
        newScale[axis] = parseFloat(value);
        setLocalState(prev => ({
            ...prev,
            objectConfig: {
                ...prev.objectConfig,
                scale: newScale
            }
        }));
    };

    const handleGeometryArgChange = (index, value) => {
        const newArgs = [...localState.objectConfig.geometryArgs];
        newArgs[index] = parseFloat(value) || 0;
        setLocalState(prev => ({
            ...prev,
            objectConfig: {
                ...prev.objectConfig,
                geometryArgs: newArgs
            }
        }));
    };

    const resetToDefaults = () => {
        setLocalState(prev => ({
            ...prev,
            objectConfig: {
                scale: [3, 3, 1],
                geometry: 'plane',
                geometryArgs: []
            },
            customTitle: '',
            customSubtitle: '',
            autoRotate: true
        }));
    };

    const applyChanges = () => {
        onThemeChange(localState.theme);
        onTextureSetChange(localState.textureSet);
        onScanModeChange(localState.scanMode);
        setCustomTitle(localState.customTitle);
        setCustomSubtitle(localState.customSubtitle);
        setObjectConfig({ ...localState.objectConfig });
        setAutoRotate(localState.autoRotate);
        onClose();
    };

    const resetForm = () => {
        setLocalState({
            theme: currentTheme,
            textureSet: currentTextureSet,
            scanMode,
            customTitle,
            customSubtitle,
            objectConfig: { ...objectConfig },
            autoRotate
        });
    };

    if (!isOpen) return null;

    const geometryType = localState.objectConfig.geometry;
    const geometryConfig = GEOMETRY_TYPES[geometryType] || GEOMETRY_TYPES.plane;
    const defaultArgs = geometryConfig.defaultArgs || [];
    const argLabels = geometryConfig.argLabels || [];

    const borderColor = `rgb(${themeConfig.scanColor.map(c => c * 255).join(',')})`;
    const bgColor = `rgba(10, 10, 20, 0.95)`;
    const textColor = `rgb(${themeConfig.scanColor.map(c => c * 200 + 55).join(',')})`;
    const highlightColor = `rgb(${themeConfig.scanColor.map(c => c * 255).join(',')})`;
    const buttonHover = `rgba(${themeConfig.scanColor.map(c => c * 255).join(',')}, 0.2)`;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md">
            <div
                className="w-full max-w-2xl max-h-[90vh] overflow-hidden rounded-xl border"
                style={{
                    borderColor: borderColor,
                    background: bgColor,
                    boxShadow: `0 0 30px ${borderColor}`
                }}
            >
                {/* Header */}
                <div
                    className="p-4 border-b flex justify-between items-center"
                    style={{ borderColor: borderColor }}
                >
                    <h2 className="text-xl font-bold" style={{ color: highlightColor }}>
                        <Sliders size={20} className="inline-block mr-2" />
                        Scanner Controls
                    </h2>
                    <button
                        onClick={onClose}
                        className="rounded-full p-1 hover:bg-white/10 transition-colors"
                        style={{ color: textColor }}
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Tabs */}
                <div className="border-b px-4 flex space-x-4" style={{ borderColor: borderColor }}>
                    {['General', 'Object', 'Appearance', 'Custom'].map(tab => (
                        <button
                            key={tab}
                            className={`py-3 font-medium relative ${false ? 'text-white' : 'text-gray-400'
                                }`}
                            style={{ color: textColor }}
                        >
                            {tab}
                            {false && (
                                <div
                                    className="absolute bottom-0 left-0 right-0 h-0.5"
                                    style={{ backgroundColor: highlightColor }}
                                />
                            )}
                        </button>
                    ))}
                </div>

                {/* Content */}
                <div className="p-4 space-y-6 overflow-y-auto max-h-[65vh]">
                    {/* Text Settings */}
                    <div className="space-y-4">
                        <h3 className="font-semibold text-lg flex items-center" style={{ color: highlightColor }}>
                            <span className="mr-2">📝</span> Text Settings
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <Label style={{ color: textColor }}>Custom Title</Label>
                                <Input
                                    value={localState.customTitle}
                                    onChange={(e) => setLocalState(prev => ({ ...prev, customTitle: e.target.value }))}
                                    placeholder="Enter custom title"
                                    className="bg-gray-900 border-gray-700 text-white"
                                />
                            </div>
                            <div>
                                <Label style={{ color: textColor }}>Custom Subtitle</Label>
                                <Input
                                    value={localState.customSubtitle}
                                    onChange={(e) => setLocalState(prev => ({ ...prev, customSubtitle: e.target.value }))}
                                    placeholder="Enter custom subtitle"
                                    className="bg-gray-900 border-gray-700 text-white"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Object Settings */}
                    <div className="space-y-4">
                        <h3 className="font-semibold text-lg flex items-center" style={{ color: highlightColor }}>
                            <span className="mr-2">🧊</span> Object Settings
                        </h3>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <Label style={{ color: textColor }}>Geometry Type</Label>
                                <Select
                                    value={localState.objectConfig.geometry}
                                    onValueChange={(value) => setLocalState(prev => ({
                                        ...prev,
                                        objectConfig: {
                                            ...prev.objectConfig,
                                            geometry: value,
                                            geometryArgs: []
                                        }
                                    }))}
                                >
                                    <SelectTrigger className="bg-gray-900 border-gray-700 text-white">
                                        <SelectValue placeholder="Select geometry" />
                                    </SelectTrigger>
                                    <SelectContent className="bg-gray-900 border border-gray-700 text-white">
                                        {Object.entries(GEOMETRY_TYPES).map(([key, geo]) => (
                                            <SelectItem
                                                key={key}
                                                value={key}
                                                className="hover:bg-gray-800"
                                            >
                                                {geo.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="flex items-center pt-6">
                                <Switch
                                    id="auto-rotate"
                                    checked={localState.autoRotate}
                                    onCheckedChange={(checked) => setLocalState(prev => ({ ...prev, autoRotate: checked }))}
                                    className="data-[state=checked]:bg-green-500"
                                />
                                <Label htmlFor="auto-rotate" className="ml-2" style={{ color: textColor }}>
                                    Auto Rotation
                                </Label>
                            </div>
                        </div>

                        <div>
                            <Label style={{ color: textColor }}>Scale</Label>
                            <div className="grid grid-cols-3 gap-2">
                                {['X', 'Y', 'Z'].map((axis, index) => (
                                    <div key={axis}>
                                        <div className="flex justify-between mb-1">
                                            <span className="text-xs" style={{ color: textColor }}>{axis}</span>
                                            <span className="text-xs text-gray-500">{localState.objectConfig.scale[index]}</span>
                                        </div>
                                        <input
                                            type="range"
                                            min="0.1"
                                            max="10"
                                            step="0.1"
                                            value={localState.objectConfig.scale[index]}
                                            onChange={(e) => handleScaleChange(index, e.target.value)}
                                            className="w-full accent-green-500"
                                        />
                                    </div>
                                ))}
                            </div>
                        </div>

                        {argLabels.length > 0 && (
                            <div>
                                <Label style={{ color: textColor }}>Geometry Parameters</Label>
                                <div className="grid grid-cols-2 gap-3">
                                    {argLabels.map((label, index) => (
                                        <div key={index}>
                                            <Label className="text-xs mb-1 block" style={{ color: textColor }}>{label}</Label>
                                            <Input
                                                type="number"
                                                min="0.1"
                                                max="10"
                                                step="0.1"
                                                value={localState.objectConfig.geometryArgs[index] ?? defaultArgs[index]}
                                                onChange={(e) => handleGeometryArgChange(index, e.target.value)}
                                                className="bg-gray-900 border-gray-700 text-white"
                                            />
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Theme Selection */}
                    <div className="space-y-4">
                        <h3 className="font-semibold text-lg flex items-center" style={{ color: highlightColor }}>
                            <Palette className="mr-2" size={18} /> Theme
                        </h3>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                            {Object.entries(themes).map(([key, theme]) => (
                                <button
                                    key={key}
                                    onClick={() => setLocalState(prev => ({ ...prev, theme: key }))}
                                    className={`p-3 rounded-lg border text-center transition-all ${localState.theme === key
                                            ? 'ring-2 ring-offset-2 ring-offset-black'
                                            : 'border-gray-700 hover:border-gray-500'
                                        }`}
                                    style={{
                                        backgroundColor: `rgba(${theme.scanColor.map(c => c * 50).join(',')}, 0.2)`,
                                        borderColor: localState.theme === key ? highlightColor : 'rgb(55, 65, 81)',
                                        color: textColor
                                    }}
                                >
                                    <div
                                        className="w-6 h-6 rounded-full mx-auto mb-2"
                                        style={{ backgroundColor: `rgb(${theme.scanColor.map(c => c * 255).join(',')})` }}
                                    />
                                    <span className="text-sm">{theme.name}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Texture & Scan Settings */}
                    <div className="space-y-4">
                        <h3 className="font-semibold text-lg flex items-center" style={{ color: highlightColor }}>
                            <Image className="mr-2" size={18} /> Texture & Scan
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <Label style={{ color: textColor }}>Texture Set</Label>
                                <Select
                                    value={localState.textureSet}
                                    onValueChange={(value) => setLocalState(prev => ({ ...prev, textureSet: value }))}
                                >
                                    <SelectTrigger className="bg-gray-900 border-gray-700 text-white">
                                        <SelectValue placeholder="Select texture" />
                                    </SelectTrigger>
                                    <SelectContent className="bg-gray-900 border border-gray-700 text-white">
                                        {Object.entries(TEXTURE_SETS).map(([key, set]) => (
                                            <SelectItem
                                                key={key}
                                                value={key}
                                                className="hover:bg-gray-800"
                                            >
                                                {set.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div>
                                <Label style={{ color: textColor }}>Scan Mode</Label>
                                <div className="flex space-x-2 mt-2">
                                    {['Horizontal', 'Vertical', 'Radial'].map((mode, index) => (
                                        <button
                                            key={index}
                                            onClick={() => setLocalState(prev => ({ ...prev, scanMode: index }))}
                                            className={`flex-1 py-2 rounded-md text-sm ${localState.scanMode === index
                                                    ? 'font-bold'
                                                    : 'opacity-70 hover:opacity-100'
                                                }`}
                                            style={{
                                                backgroundColor: localState.scanMode === index
                                                    ? `rgba(${themeConfig.scanColor.map(c => c * 255).join(',')}, 0.2)`
                                                    : 'rgba(55, 65, 81, 0.5)',
                                                border: localState.scanMode === index
                                                    ? `1px solid ${highlightColor}`
                                                    : '1px solid rgb(55, 65, 81)',
                                                color: textColor
                                            }}
                                        >
                                            {mode}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Custom Texture */}
                    <div className="space-y-4">
                        <h3 className="font-semibold text-lg flex items-center" style={{ color: highlightColor }}>
                            <Upload className="mr-2" size={18} /> Custom Texture
                        </h3>
                        <Button
                            onClick={() => setShowCustomForm(!showCustomForm)}
                            variant="outline"
                            className="w-full bg-gray-900 border-gray-700 hover:bg-gray-800"
                            style={{ color: textColor }}
                        >
                            {showCustomForm ? 'Cancel Custom Texture' : 'Add Custom Texture'}
                        </Button>

                        {showCustomForm && (
                            <form onSubmit={handleCustomSubmit} className="space-y-3 mt-3">
                                <div>
                                    <Label style={{ color: textColor }}>Texture URL</Label>
                                    <Input
                                        type="url"
                                        value={customTexture}
                                        onChange={(e) => setCustomTexture(e.target.value)}
                                        placeholder="https://example.com/texture.jpg"
                                        className="bg-gray-900 border-gray-700 text-white"
                                    />
                                </div>
                                <div>
                                    <Label style={{ color: textColor }}>Depth Map URL</Label>
                                    <Input
                                        type="url"
                                        value={customDepthMap}
                                        onChange={(e) => setCustomDepthMap(e.target.value)}
                                        placeholder="https://example.com/depthmap.jpg"
                                        className="bg-gray-900 border-gray-700 text-white"
                                    />
                                </div>
                                <Button
                                    type="submit"
                                    className="w-full"
                                    style={{ backgroundColor: highlightColor }}
                                >
                                    Apply Custom Textures
                                </Button>
                            </form>
                        )}
                    </div>

                    {/* Pro Tip */}
                    <div
                        className="p-3 rounded-lg border mt-4"
                        style={{
                            backgroundColor: 'rgba(30, 58, 138, 0.2)',
                            borderColor: 'rgb(59, 130, 246)',
                            color: 'rgb(191, 219, 254)'
                        }}
                    >
                        <h4 className="font-semibold mb-1 flex items-center">
                            <span className="mr-2">💡</span> Pro Tip
                        </h4>
                        <p className="text-sm">
                            For best results, use images with transparent backgrounds and matching depth maps for realistic holographic effects!
                        </p>
                    </div>
                </div>

                {/* Footer */}
                <div
                    className="p-4 border-t flex justify-between"
                    style={{ borderColor: borderColor }}
                >
                    <Button
                        onClick={resetToDefaults}
                        variant="outline"
                        className="bg-gray-900 border-gray-700 hover:bg-gray-800"
                        style={{ color: textColor }}
                    >
                        <RotateCcw size={16} className="mr-2" />
                        Reset Defaults
                    </Button>

                    <div className="flex space-x-3">
                        <Button
                            onClick={resetForm}
                            className="bg-gray-800 hover:bg-gray-700"
                            style={{ color: textColor }}
                        >
                            Discard
                        </Button>
                        <Button
                            onClick={applyChanges}
                            className="font-bold hover:brightness-110 transition-all"
                            style={{
                                backgroundColor: highlightColor,
                                boxShadow: `0 0 15px ${highlightColor}`
                            }}
                        >
                            Apply Changes
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
};

const AnimatedText = ({ theme, customTitle, customSubtitle }) => {
    const themeConfig = themes[theme];
    const title = customTitle || themeConfig.title;
    const subtitle = customSubtitle || themeConfig.subtitle;
    const titleWords = title.split(' ');
    const [visibleWords, setVisibleWords] = useState(0);
    const [subtitleVisible, setSubtitleVisible] = useState(false);

    useEffect(() => {
        setVisibleWords(0);
        setSubtitleVisible(false);
    }, [theme, title]);

    useEffect(() => {
        if (visibleWords < titleWords.length) {
            const timeout = setTimeout(() => setVisibleWords(visibleWords + 1), 400);
            return () => clearTimeout(timeout);
        } else {
            const timeout = setTimeout(() => setSubtitleVisible(true), 600);
            return () => clearTimeout(timeout);
        }
    }, [visibleWords, titleWords.length]);

    return (
        <div className="absolute z-40 inset-0 flex flex-col items-center justify-center pointer-events-none px-10">
            <div className="text-3xl md:text-5xl xl:text-6xl font-extrabold uppercase">
                <div className="flex space-x-2 lg:space-x-4 flex-wrap justify-center">
                    {titleWords.map((word, index) => (
                        <div
                            key={`${theme}-${index}-${title}`}
                            className={`${themeConfig.textColor} transition-all duration-300 ${index < visibleWords ? 'opacity-100 animate-pulse' : 'opacity-0'
                                }`}
                            style={{
                                textShadow: `0 0 20px currentColor, 0 0 40px currentColor`
                            }}
                        >
                            {word}
                        </div>
                    ))}
                </div>
            </div>
            <div className="text-sm md:text-xl xl:text-2xl mt-4 font-bold uppercase text-center">
                <div
                    className={`${themeConfig.textColor} transition-all duration-500 ${subtitleVisible ? 'opacity-100' : 'opacity-0'
                        }`}
                    style={{
                        textShadow: `0 0 10px currentColor`
                    }}
                >
                    {subtitle}
                </div>
            </div>
        </div>
    );
};

export default function HolographicScanner() {
    const [currentTheme, setCurrentTheme] = useState('cyberpunk');
    const [currentTextureSet, setCurrentTextureSet] = useState('face');
    const [scanMode, setScanMode] = useState(0);
    const [customTextures, setCustomTextures] = useState(null);
    const [showControls, setShowControls] = useState(false);
    const [customTitle, setCustomTitle] = useState('');
    const [customSubtitle, setCustomSubtitle] = useState('');
    const [autoRotate, setAutoRotate] = useState(false);
    const [objectConfig, setObjectConfig] = useState({
        scale: [3, 3, 1],
        geometry: 'plane',
        geometryArgs: []
    });

    const themeConfig = themes[currentTheme];

    return (
        <div className={`h-screen w-full bg-gradient-to-br ${themeConfig.bgGradient} relative overflow-hidden`}>
            <button
                onClick={() => setShowControls(true)}
                className="absolute top-4 right-4 z-40 bg-black/70 hover:bg-black/90 text-white p-3 rounded-full backdrop-blur-sm transition-all duration-300 hover:scale-110"
                style={{ color: `rgb(${themeConfig.scanColor.map(c => c * 255).join(',')})` }}
            >
                <Settings size={24} />
            </button>

            <PopupControls
                isOpen={showControls}
                onClose={() => setShowControls(false)}
                currentTheme={currentTheme}
                onThemeChange={setCurrentTheme}
                currentTextureSet={currentTextureSet}
                onTextureSetChange={setCurrentTextureSet}
                scanMode={scanMode}
                onScanModeChange={setScanMode}
                onCustomTexture={setCustomTextures}
                customTitle={customTitle}
                setCustomTitle={setCustomTitle}
                customSubtitle={customSubtitle}
                setCustomSubtitle={setCustomSubtitle}
                objectConfig={objectConfig}
                setObjectConfig={setObjectConfig}
                autoRotate={autoRotate}
                setAutoRotate={setAutoRotate}
                themeConfig={themeConfig}
            />


            <AnimatedText
                theme={currentTheme}
                customTitle={customTitle}
                customSubtitle={customSubtitle}
            />

            <Canvas
                camera={{ position: [0, 0, 5], fov: 45 }}
                style={{ background: 'transparent' }}
            >
                <Scene
                    theme={currentTheme}
                    textureSet={currentTextureSet}
                    scanMode={scanMode}
                    customTextures={customTextures}
                    objectConfig={objectConfig}
                    autoRotate={autoRotate}
                />
            </Canvas>

        </div>
    );
}