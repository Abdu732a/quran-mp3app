import React, { useState, useEffect, useRef, useCallback, memo } from 'react';
import {
  StyleSheet,
  Text,
  View,
  FlatList,
  TouchableOpacity,
  Image,
  Modal,
  Dimensions,
  StatusBar,
  ActivityIndicator,
  BackHandler
} from 'react-native';
import { Audio } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';
import Slider from '@react-native-community/slider';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { surahList } from './surahData';

const { width, height } = Dimensions.get('window');

const COLORS = {
  bg: '#0F172A',
  card: '#1E293B',
  gold: '#D4AF37',
  green: '#10B981',
  text: '#F8FAFC',
  subText: '#94A3B8'
};

// --- OPTIMIZED ROW COMPONENT ---
const SurahItem = memo(({ item, index, isCurrent, isPlaying, isLoading, onPress }) => {
  return (
    <TouchableOpacity
      style={[styles.card, isCurrent && styles.activeCard]}
      onPress={() => onPress(index)}
      disabled={isLoading && !isCurrent}
    >
      <View style={styles.numberContainer}>
        <Text style={styles.numberText}>{item.id}</Text>
      </View>
      <View style={styles.textContainer}>
        <Text style={styles.englishName}>{item.title}</Text>
        <Text style={styles.arabicName}>{item.arabic}</Text>
      </View>
      {isLoading && isCurrent ? (
        <ActivityIndicator color={COLORS.green} />
      ) : (
        <Ionicons
          name={isCurrent && isPlaying ? "pause-circle" : "play-circle"}
          size={35}
          color={COLORS.green}
        />
      )}
    </TouchableOpacity>
  );
});

export default function App() {
  return (
    <SafeAreaProvider>
      <MainAppContent />
    </SafeAreaProvider>
  );
}

function MainAppContent() {
  const insets = useSafeAreaInsets();
  const sound = useRef(new Audio.Sound());
  const [currentIndex, setCurrentIndex] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPlayerOpen, setIsPlayerOpen] = useState(false);
  const [isShuffle, setIsShuffle] = useState(false);
  const [repeatMode, setRepeatMode] = useState(0);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  // Refs for background logic and listeners
  const currentIndexRef = useRef(null);
  const isShuffleRef = useRef(false);
  const repeatModeRef = useRef(0);

  useEffect(() => {
    Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      staysActiveInBackground: true, // Background play fix
      playsInSilentModeIOS: true,
      shouldDuckAndroid: true,
      playThroughEarpieceAndroid: false,
    });
    return () => { sound.current.unloadAsync(); };
  }, []);

  // Sync refs to keep handleNext accurate
  useEffect(() => { currentIndexRef.current = currentIndex; }, [currentIndex]);
  useEffect(() => { isShuffleRef.current = isShuffle; }, [isShuffle]);
  useEffect(() => { repeatModeRef.current = repeatMode; }, [repeatMode]);

  // --- HARDWARE BACK BUTTON INTERCEPTOR ---
  useEffect(() => {
    const handleHardwareBack = () => {
      if (isPlayerOpen) {
        setIsPlayerOpen(false);
        return true; // Stops app from exiting completely
      }
      return false;
    };

    const backHandler = BackHandler.addEventListener('hardwareBackPress', handleHardwareBack);
    return () => backHandler.remove();
  }, [isPlayerOpen]);

  const onPlaybackStatusUpdate = (status) => {
    if (status.isLoaded) {
      setPosition(status.positionMillis);
      setDuration(status.durationMillis);
      setIsPlaying(status.isPlaying);

      if (status.didJustFinish && !status.isLooping) {
        handleNext();
      }
    }
  };

  async function loadAndPlay(index) {
    if (index < 0 || index >= surahList.length) return;

    try {
      setIsLoading(true);
      const status = await sound.current.getStatusAsync();

      if (status.isLoaded) {
        await sound.current.stopAsync();
        await sound.current.unloadAsync();
      }

      await sound.current.loadAsync(surahList[index].file, { shouldPlay: true });
      sound.current.setOnPlaybackStatusUpdate(onPlaybackStatusUpdate);

      setCurrentIndex(index);
    } catch (error) {
      console.log("Playback Error:", error);
    } finally {
      setIsLoading(false);
    }
  }

  const handleNext = useCallback(() => {
    const currIdx = currentIndexRef.current;
    let nextIndex;

    if (repeatModeRef.current === 2) {
      nextIndex = currIdx;
    } else if (isShuffleRef.current) {
      nextIndex = Math.floor(Math.random() * surahList.length);
    } else {
      nextIndex = currIdx + 1;
    }

    if (nextIndex < surahList.length) {
      loadAndPlay(nextIndex);
    } else if (repeatModeRef.current === 1) {
      loadAndPlay(0);
    }
  }, []);

  const handlePrevious = () => {
    const prevIndex = currentIndex - 1;
    if (prevIndex >= 0) loadAndPlay(prevIndex);
  };

  const togglePlayback = async () => {
    const status = await sound.current.getStatusAsync();
    if (status.isLoaded) {
      status.isPlaying ? await sound.current.pauseAsync() : await sound.current.playAsync();
    }
  };

  const formatTime = (millis) => {
    const sec = Math.floor((millis / 1000) % 60);
    const min = Math.floor((millis / 1000) / 60);
    return `${min}:${sec < 10 ? '0' : ''}${sec}`;
  };

  const handleSurahPress = useCallback((index) => {
    loadAndPlay(index);
    setIsPlayerOpen(true);
  }, []);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="light-content" />

      <View style={styles.header}>
        <View style={styles.logoContainer}>
          <Image source={require('./assets/quran-logo.jpg')} style={styles.logo} resizeMode="contain" />
        </View>
        <Text style={styles.headerTitle}>Juz Amma</Text>
        <Text style={styles.headerSubtitle}>Sheikh Muhammad Ayyub</Text>
      </View>

      <FlatList
        data={surahList}
        keyExtractor={(item) => item.id}
        initialNumToRender={12}
        maxToRenderPerBatch={5}
        windowSize={5}
        removeClippedSubviews={true}
        contentContainerStyle={{ paddingBottom: 120, paddingHorizontal: 15 }}
        renderItem={({ item, index }) => (
          <SurahItem
            item={item}
            index={index}
            isCurrent={currentIndex === index}
            isPlaying={isPlaying}
            isLoading={isLoading}
            onPress={handleSurahPress}
          />
        )}
      />

      {currentIndex !== null && !isPlayerOpen && (
        <TouchableOpacity
          style={[styles.miniPlayer, { bottom: insets.bottom > 0 ? insets.bottom + 10 : 15 }]}
          onPress={() => setIsPlayerOpen(true)}
        >
          <Image source={require('./assets/reciter.jpg')} style={styles.miniArt} />
          <Text style={styles.miniText}>{surahList[currentIndex].title}</Text>
          <TouchableOpacity onPress={togglePlayback} style={{ padding: 10 }}>
            <Ionicons name={isPlaying ? "pause" : "play"} size={28} color="white" />
          </TouchableOpacity>
        </TouchableOpacity>
      )}

      <Modal
        visible={isPlayerOpen}
        animationType="slide"
        transparent={false}
        onRequestClose={() => setIsPlayerOpen(false)}
      >
        {/* Dynamic Safe padding added here directly handles both ___ and ||| layouts seamlessly */}
        <View style={[
          styles.fullPlayer,
          {
            paddingTop: insets.top > 0 ? insets.top : 20,
            paddingBottom: insets.bottom > 0 ? insets.bottom + 10 : 30
          }
        ]}>

          {/* TOP SECTION */}
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setIsPlayerOpen(false)} style={styles.closeTouchArea}>
              <Ionicons name="chevron-down" size={36} color="white" />
            </TouchableOpacity>
            <Text style={styles.nowPlayingLabel}>NOW PLAYING</Text>
            <View style={{ width: 36 }} />
          </View>

          {/* MIDDLE SECTION: Dynamic Scaled Art to prevent screen crowding */}
          <View style={styles.middleContainer}>
            <View style={styles.artContainer}>
              <Image source={require('./assets/reciter.jpg')} style={styles.largeArt} />
            </View>

            <View style={styles.infoContainer}>
              <Text style={styles.largeTitle} numberOfLines={1}>{surahList[currentIndex]?.title}</Text>
              <Text style={styles.largeArabic}>{surahList[currentIndex]?.arabic}</Text>
            </View>
          </View>

          {/* BOTTOM PLAYER MANAGEMENT SECTION */}
          <View style={styles.bottomPlaybackSection}>
            <View style={styles.progressContainer}>
              <Slider
                style={styles.slider}
                value={position}
                minimumValue={0}
                maximumValue={duration}
                minimumTrackTintColor={COLORS.green}
                maximumTrackTintColor="#444"
                thumbTintColor={COLORS.green}
                onSlidingComplete={async (value) => await sound.current.setPositionAsync(value)}
              />
              <View style={styles.timeRow}>
                <Text style={styles.timeText}>{formatTime(position)}</Text>
                <Text style={styles.timeText}>{formatTime(duration)}</Text>
              </View>
            </View>

            <View style={styles.controls}>
              <TouchableOpacity onPress={() => setIsShuffle(!isShuffle)} style={styles.utilityButton}>
                <Ionicons name="shuffle" size={26} color={isShuffle ? COLORS.green : "#777"} />
              </TouchableOpacity>

              <TouchableOpacity onPress={handlePrevious} style={styles.utilityButton}>
                <Ionicons name="play-skip-back" size={40} color="white" />
              </TouchableOpacity>

              <TouchableOpacity onPress={togglePlayback}>
                <Ionicons name={isPlaying ? "pause-circle" : "play-circle"} size={85} color="white" />
              </TouchableOpacity>

              <TouchableOpacity onPress={handleNext} style={styles.utilityButton}>
                <Ionicons name="play-skip-forward" size={40} color="white" />
              </TouchableOpacity>

              <TouchableOpacity onPress={() => setRepeatMode((repeatMode + 1) % 3)} style={styles.utilityButton}>
                <Ionicons name="repeat" size={26} color={repeatMode > 0 ? COLORS.green : "#777"} />
                {repeatMode === 2 && <View style={styles.repeatOneBadge}><Text style={styles.badgeText}>1</Text></View>}
              </TouchableOpacity>
            </View>
          </View>

        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  header: { alignItems: 'center', paddingBottom: 15, paddingTop: 5 },
  logoContainer: { width: 74, height: 74, borderRadius: 37, backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center', marginBottom: 8, borderWidth: 1.5, borderColor: COLORS.gold },
  logo: { width: 64, height: 64, borderRadius: 32 },
  headerTitle: { color: COLORS.gold, fontSize: 22, fontWeight: 'bold' },
  headerSubtitle: { color: COLORS.subText, fontSize: 13 },
  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.card, borderRadius: 12, padding: 15, marginBottom: 10, marginHorizontal: 5 },
  activeCard: { borderLeftWidth: 5, borderLeftColor: COLORS.green },
  numberContainer: { width: 30, height: 30, borderRadius: 15, borderWidth: 1, borderColor: COLORS.gold, justifyContent: 'center', alignItems: 'center', marginRight: 15 },
  numberText: { color: COLORS.gold, fontSize: 12 },
  textContainer: { flex: 1 },
  englishName: { color: 'white', fontSize: 16, fontWeight: '600' },
  arabicName: { color: COLORS.gold, fontSize: 18, marginTop: 2 },

  miniPlayer: { position: 'absolute', left: 15, right: 15, backgroundColor: '#1e293b', borderRadius: 12, height: 60, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 15, borderBottomWidth: 3, borderBottomColor: COLORS.green, elevation: 10, zIndex: 99 },
  miniArt: { width: 40, height: 40, borderRadius: 6, marginRight: 12 },
  miniText: { color: 'white', flex: 1, fontWeight: 'bold' },

  // Responsive Modal Flow layout rules
  fullPlayer: { flex: 1, backgroundColor: COLORS.bg, paddingHorizontal: 24, justifyContent: 'space-between' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', height: 50 },
  closeTouchArea: { paddingRight: 20, paddingVertical: 5 },
  nowPlayingLabel: { color: COLORS.subText, fontSize: 12, letterSpacing: 2, fontWeight: '600' },

  middleContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  artContainer: { alignItems: 'center', justifyContent: 'center', marginVertical: '5%' },
  largeArt: { width: width * 0.72, height: width * 0.72, maxHeight: height * 0.35, borderRadius: 20 },

  infoContainer: { alignItems: 'center', width: '100%', paddingHorizontal: 10, marginTop: 5 },
  largeTitle: { color: 'white', fontSize: 26, fontWeight: 'bold', textAlign: 'center' },
  largeArabic: { color: COLORS.gold, fontSize: 24, marginTop: 4 },

  bottomPlaybackSection: { width: '100%', justifyContent: 'flex-end', marginTop: 'auto' },
  progressContainer: { marginBottom: 15 },
  slider: { width: '105%', height: 30, alignSelf: 'center' },
  timeRow: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 4 },
  timeText: { color: COLORS.subText, fontSize: 12 },

  controls: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', width: '100%' },
  utilityButton: { padding: 10, alignItems: 'center', justifyContent: 'center' },
  repeatOneBadge: { position: 'absolute', backgroundColor: COLORS.green, borderRadius: 6, width: 13, height: 13, bottom: 2, right: 2, justifyContent: 'center', alignItems: 'center' },
  badgeText: { fontSize: 8, color: 'black', fontWeight: 'bold' }
});