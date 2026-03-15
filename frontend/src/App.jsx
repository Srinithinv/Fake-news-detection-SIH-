import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion'; // eslint-disable-line no-unused-vars
import { FiCheckCircle, FiXCircle, FiRefreshCw, FiAlertTriangle, FiLink, FiFileText, FiClock, FiShare2, FiDownload, FiFlag, FiInfo, FiActivity, FiUpload, FiEye } from 'react-icons/fi';
import axios from 'axios';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Filler,
  Legend,
} from 'chart.js';
import { Line } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Filler,
  Legend
);

const API_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';
console.log("Connecting to API at:", API_URL);

// Helper function to extract domain from URL
const extractDomain = (url) => {
  try {
    return new URL(url).hostname.replace('www.', '');
  } catch {
    return null;
  }
};

function App() {
  const [inputType, setInputType] = useState('text'); // 'text', 'url', or 'image'
  const [text, setText] = useState('');
  const [url, setUrl] = useState('');
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [history, setHistory] = useState([]);
  const [backendStatus, setBackendStatus] = useState('checking'); // 'checking', 'online', 'offline'
  
  // Toast state
  const [toast, setToast] = useState({ show: false, message: '', type: 'info' });

  // Load history and check backend on mount
  useEffect(() => {
    const saved = localStorage.getItem('fakeNewsHistory');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) setHistory(parsed);
      } catch {
        console.error("Failed to parse history.");
      }
    }

    // Backend Health Check
    const checkBackend = async () => {
      try {
        await axios.get(`${API_URL}/`);
        setBackendStatus('online');
      } catch (err) {
        console.error("Health check failed:", err.message);
        setBackendStatus('offline');
      }
    };
    checkBackend();
    const interval = setInterval(checkBackend, 10000); // Check every 10s
    return () => clearInterval(interval);
  }, []);

  const showToast = (message, type = 'info') => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: '', type: 'info' }), 3000);
  };

  const handleAnalyze = async (e) => {
    e.preventDefault();
    if (inputType === 'text' && !text.trim()) {
      setError('Please enter some text to analyze.');
      return;
    }
    if (inputType === 'url') {
      let urlToTest = url.trim();
      if (!urlToTest) {
        setError('Please enter a valid URL.');
        return;
      }
      // Basic protocol check
      if (!urlToTest.startsWith('http')) {
        urlToTest = 'https://' + urlToTest;
      }
      setUrl(urlToTest); // Sync state
    }
    
    if (inputType === 'image' && !imageFile) {
      setError('Please upload an image to analyze.');
      return;
    }

    setLoading(true);
    setError(''); // Immediate clear
    setResult(null);

    try {
      let response;
      let newResult;

      if (inputType === 'image') {
        const formData = new FormData();
        formData.append('file', imageFile);
        response = await axios.post(`${API_URL}/predict-image`, formData);
        
        newResult = {
          type: 'image',
          integrity: response.data.integrity_score,
          isTampered: response.data.is_tampered,
          aiProb: response.data.ai_generated_prob,
          imageType: response.data.image_type,
          ocrText: response.data.ocr_text,
          prediction: response.data.content_prediction,
          confidence: response.data.content_confidence,
          elaImage: response.data.ela_image_base64,
          contentSource: 'Image Payload',
          timestamp: new Date().toISOString(),
          isFake: response.data.content_prediction === 'Fake'
        };
      } else {
        const finalUrl = inputType === 'url' ? (url.startsWith('http') ? url : 'https://' + url) : '';
        const payload = inputType === 'url' ? { text: '', url: finalUrl } : { text: text, url: '' };
        response = await axios.post(`${API_URL}/predict`, payload);
        
        newResult = {
          type: 'text',
          prediction: response.data.prediction + ' News',
          isFake: response.data.prediction === 'Fake',
          confidence: Number((response.data.probability * 100).toFixed(0)),
          scrapedText: response.data.scraped_text,
          topWords: response.data.top_words,
          manipulationMetrics: response.data.manipulation_metrics,
          manipulationScore: response.data.manipulation_score,
          contentSource: inputType === 'url' ? extractDomain(url) || url : (text.substring(0, 50) + '...'),
          isUrl: inputType === 'url',
          timestamp: new Date().toISOString()
        };
      }
      
      // Success: Perform state updates
      setResult(newResult);
      setError(''); 
      
      // Save to history (wrapped to prevent large images from breaking the flow)
      try {
        const updatedHistory = [newResult, ...history].slice(0, 10);
        setHistory(updatedHistory);
        localStorage.setItem('fakeNewsHistory', JSON.stringify(updatedHistory));
      } catch (historyErr) {
        console.warn("History sync failed (likely quota limit):", historyErr);
        // If it fails, we still have the current result, just don't crash
      }
      
      showToast('Neural analysis complete.', 'success');
    } catch (err) {
      console.error(err);
      setError('Analysis failed. The neural uplink was interrupted.');
    } finally {
      setLoading(false);
    }
  };

  const handleClear = () => {
    setText('');
    setUrl('');
    setImageFile(null);
    setImagePreview(null);
    setResult(null);
    setError('');
  };

  const loadSample = (type) => {
    if (type === 'real') {
      setText("The Federal Reserve announced a new 0.25% interest rate hike today to combat inflation and maintain economic stability.");
      setInputType('text');
    } else {
      setText("Secret billionaire cabal is controlling the weather using giant space lasers to manipulate global crop prices!");
      setInputType('text');
    }
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => setImagePreview(reader.result);
      reader.readAsDataURL(file);
    }
  };

  const handleShare = async () => {
    if (!result) return;
    const shareText = `TruthLens AI Analysis [Cyberpunk Node]:\nPrediction: ${result.prediction}\nConfidence: ${result.confidence}%\nSource: ${result.contentSource}`;
    
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Fake News Analysis Result',
          text: shareText,
        });
      } catch (err) {
        if (err.name !== 'AbortError') {
          navigator.clipboard.writeText(shareText);
          showToast('Data sequence copied to clipboard!', 'success');
        }
      }
    } else {
      navigator.clipboard.writeText(shareText);
      showToast('Data sequence copied to clipboard!', 'success');
    }
  };

  const handleDownload = () => {
    if (!result) return;
    const reportData = JSON.stringify(result, null, 2);
    const blob = new Blob([reportData], { type: 'application/json' });
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = 'TruthLens_Report.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(blobUrl);
    showToast('Report packet downloaded.', 'success');
  };

  const handleReport = async () => {
    if (!result) return;
    try {
      await axios.post('http://localhost:8000/report', {
        url: inputType === 'url' ? url : '',
        text: inputType === 'text' ? text : '',
        prediction: result.prediction,
        is_correct: false,
        details: 'User reported this prediction as potentially inaccurate.'
      });
      showToast('Feedback sync complete.', 'success');
    } catch {
      showToast('Sync failed. Try again.', 'error');
    }
  };

  // Prepare chart data
  const chartDataReversed = [...history].reverse(); // oldest to newest for the chart timeline
  const chartConfig = {
    labels: chartDataReversed.map((_, idx) => `Scan ${idx + 1}`),
    datasets: [
      {
        label: 'Authenticity Confidence (%)',
        data: chartDataReversed.map(item => item.isFake ? (100 - item.confidence) : item.confidence),
        borderColor: 'rgba(6, 182, 212, 1)', // Cyan-500
        backgroundColor: 'rgba(6, 182, 212, 0.1)',
        borderWidth: 2,
        fill: true,
        tension: 0.4,
        pointBackgroundColor: chartDataReversed.map(item => item.isFake ? '#f43f5e' : '#10b981'), // Rose for fake, Emerald for real
        pointBorderColor: 'rgba(255,255,255,0.1)',
        pointRadius: 4,
        pointHoverRadius: 6,
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: 'rgba(15, 23, 42, 0.9)',
        titleColor: '#cbd5e1',
        bodyColor: '#f8fafc',
        borderColor: 'rgba(51, 65, 85, 0.5)',
        borderWidth: 1,
        callbacks: {
          label: (context) => {
            const item = chartDataReversed[context.dataIndex];
            return `${item.prediction} (${item.confidence}%)`;
          }
        }
      }
    },
    scales: {
      y: { 
        min: 0, 
        max: 100,
        grid: { color: 'rgba(51, 65, 85, 0.2)' },
        ticks: { color: '#64748b' }
      },
      x: { 
        grid: { display: false },
        ticks: { display: false } 
      }
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 font-sans selection:bg-cyan-500/30 pb-20 md:pb-0 overflow-x-hidden">
      
      {/* Cyberpunk Glow Ornaments */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full bg-cyan-900/10 blur-[120px]"></div>
        <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] rounded-full bg-rose-900/10 blur-[120px]"></div>
        <div className="absolute top-[40%] right-[30%] w-[20%] h-[20%] rounded-full bg-violet-900/10 blur-[90px]"></div>
        {/* Subtle Grid pattern overlay */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:32px_32px] [mask-image:radial-gradient(ellipse_80%_80%_at_50%_0%,#000_70%,transparent_100%)]"></div>
      </div>

      <div className="relative z-10 container mx-auto px-4 sm:px-6 py-8 md:py-12 max-w-7xl flex flex-col min-h-screen">
        
        {/* Header */}
        <motion.header 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-10 md:mb-14"
        >
          <div className="inline-flex items-center justify-center p-2 mb-4 rounded-xl bg-slate-900/50 border border-slate-800 shadow-[0_0_20px_rgba(6,182,212,0.1)] backdrop-blur-md">
            <div className={`p-2 rounded-lg mr-3 border hidden sm:block ${backendStatus === 'online' ? 'bg-emerald-950/30 border-emerald-900/50 text-emerald-400' : 'bg-rose-950/30 border-rose-900/50 text-rose-400'}`}>
               {backendStatus === 'online' ? <FiActivity className="text-xl animate-pulse" /> : <FiAlertTriangle className="text-xl" />}
            </div>
            <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight bg-gradient-to-r from-cyan-400 via-blue-400 to-indigo-400 bg-clip-text text-transparent pb-1 px-4">
              TruthLens // OS
            </h1>
          </div>
          <div className="flex items-center justify-center gap-4 mt-2">
            <p className="text-slate-400 text-sm md:text-lg font-medium tracking-wide">
              Neural text classification terminal.
            </p>
            <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-[10px] font-mono leading-none ${backendStatus === 'online' ? 'bg-emerald-950/20 border-emerald-900/30 text-emerald-500' : 'bg-rose-950/20 border-rose-900/30 text-rose-500'}`}>
               <span className={`w-1.5 h-1.5 rounded-full ${backendStatus === 'online' ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`}></span>
               {backendStatus === 'online' ? 'SYSTEM_ONLINE' : 'SYSTEM_OFFLINE'}
            </div>
          </div>
        </motion.header>

        {/* Main Content Area */}
        <div className="flex-grow flex flex-col lg:flex-row gap-8 lg:gap-10 items-start w-full">
          
          {/* Left Column: Input Panel */}
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
            className="w-full lg:w-[45%] xl:w-[40%] flex flex-col gap-6"
          >
            {/* Input Terminal */}
            <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-[0_8px_30px_rgb(0,0,0,0.5)] relative overflow-hidden group">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-cyan-500 to-indigo-500 opacity-50 group-hover:opacity-100 transition-opacity"></div>
              
              {/* Input Type Toggle */}
              <div className="flex p-1 mb-6 bg-slate-950 rounded-xl border border-slate-800 shadow-inner">
                <button
                  onClick={() => setInputType('text')}
                  className={`flex-1 py-2.5 px-4 rounded-lg flex items-center justify-center gap-2 text-sm font-semibold transition-all duration-300 ${
                    inputType === 'text' ? 'bg-slate-800 text-cyan-400 shadow-sm border border-slate-700' : 'text-slate-500 hover:text-slate-300 hover:bg-slate-900'
                  }`}
                >
                  <FiFileText className="text-lg" /> Raw Text
                </button>
                <button
                  onClick={() => setInputType('url')}
                  className={`flex-1 py-2.5 px-4 rounded-lg flex items-center justify-center gap-2 text-sm font-semibold transition-all duration-300 ${
                    inputType === 'url' ? 'bg-slate-800 text-cyan-400 shadow-sm border border-slate-700' : 'text-slate-500 hover:text-slate-300 hover:bg-slate-900'
                  }`}
                >
                  <FiLink className="text-lg" /> Data URL
                </button>
                <button
                  onClick={() => setInputType('image')}
                  className={`flex-1 py-2.5 px-4 rounded-lg flex items-center justify-center gap-2 text-sm font-semibold transition-all duration-300 ${
                    inputType === 'image' ? 'bg-slate-800 text-cyan-400 shadow-sm border border-slate-700' : 'text-slate-500 hover:text-slate-300 hover:bg-slate-900'
                  }`}
                >
                  <FiUpload className="text-lg" /> Image Node
                </button>
              </div>

              <form onSubmit={handleAnalyze} className="flex flex-col">
                <AnimatePresence mode="wait">
                  {inputType === 'text' ? (
                    <motion.div
                      key="text-input"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="flex flex-col"
                    >
                      <label htmlFor="article-text" className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3 flex items-center justify-between">
                        <div className="flex gap-4 items-center">
                          <span>Input Stream</span>
                          <button type="button" onClick={() => loadSample('real')} className="text-[10px] text-cyan-500/50 hover:text-cyan-400 border border-cyan-500/20 px-1.5 py-0.5 rounded transition-colors uppercase">Real Sample</button>
                          <button type="button" onClick={() => loadSample('fake')} className="text-[10px] text-rose-500/50 hover:text-rose-400 border border-rose-500/20 px-1.5 py-0.5 rounded transition-colors uppercase">Fake Sample</button>
                        </div>
                        <span className="text-cyan-500/70 font-mono text-[10px]">{text.length} bytes</span>
                      </label>
                      <textarea
                        id="article-text"
                        value={text}
                        onChange={(e) => setText(e.target.value)}
                        placeholder="Paste article payload here..."
                        className="w-full h-48 sm:h-56 bg-slate-950/50 border border-slate-800 rounded-xl p-4 sm:p-5 text-slate-300 placeholder-slate-600 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/50 transition-all resize-none shadow-inner font-mono text-sm"
                      />
                    </motion.div>
                  ) : inputType === 'url' ? (
                    <motion.div
                      key="url-input"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="flex flex-col"
                    >
                      <label htmlFor="article-url" className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">
                        Target Endpoint URL
                      </label>
                      <input
                        id="article-url"
                        type="url"
                        value={url}
                        onChange={(e) => setUrl(e.target.value)}
                        placeholder="https://example.com/breaking-news"
                        className="w-full bg-slate-950/50 border border-slate-800 rounded-xl p-4 sm:p-5 text-slate-300 placeholder-slate-600 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/50 transition-all shadow-inner font-mono text-sm"
                      />
                      <p className="mt-3 text-xs text-slate-500/80 font-mono leading-relaxed">
                        &gt; Extracting article bodies from secured domains may fail.
                      </p>
                    </motion.div>
                  ) : (
                    <motion.div
                      key="image-input"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="flex flex-col"
                    >
                      <label className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">
                        Forensic Image Source
                      </label>
                      <div className="relative group/upload h-48 sm:h-56 bg-slate-950/50 border-2 border-dashed border-slate-800 hover:border-cyan-500/50 rounded-xl transition-all flex flex-col items-center justify-center cursor-pointer overflow-hidden p-4">
                         <input type="file" accept="image/*" onChange={handleImageChange} className="absolute inset-0 opacity-0 cursor-pointer z-10" />
                         {imagePreview ? (
                           <img src={imagePreview} alt="Preview" className="w-full h-full object-cover opacity-50 absolute inset-0 group-hover/upload:scale-105 transition-transform" />
                         ) : null}
                         <div className="relative z-0 flex flex-col items-center">
                            <FiUpload className="text-3xl text-slate-600 mb-3 group-hover/upload:text-cyan-400 transition-colors" />
                            <p className="text-xs text-slate-500 font-mono uppercase tracking-widest">
                               {imageFile ? imageFile.name : 'Inject Image Metadata'}
                            </p>
                            <p className="text-[10px] text-slate-700 mt-2">Support: JPG, PNG, WEBP</p>
                         </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {error && !loading && !result && (
                  <motion.div 
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="mt-6 text-rose-400 text-sm font-medium flex items-start bg-rose-950/30 p-4 rounded-xl border border-rose-900/50"
                  >
                    <FiAlertTriangle className="mr-2 mt-0.5 shrink-0 text-rose-500 text-lg" /> <span className="break-words flex-1">{error}</span>
                  </motion.div>
                )}

                <div className="mt-8 flex flex-col sm:flex-row gap-3">
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex-1 w-full bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold py-3.5 px-6 rounded-xl shadow-[0_0_15px_rgba(6,182,212,0.3)] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center group text-sm uppercase tracking-widest"
                  >
                    {loading ? (
                      <>
                        <FiRefreshCw className="animate-spin mr-3 text-lg" />
                        Processing...
                      </>
                    ) : (
                      <span>Execute Scan</span>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={handleClear}
                    className="w-full sm:w-auto px-6 py-3.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold border border-slate-700 transition-colors flex items-center justify-center shrink-0 text-sm uppercase tracking-widest"
                  >
                    Abort
                  </button>
                </div>
              </form>
            </div>

            {/* Credibility History Chart */}
            {history.length > 2 && (
              <motion.div 
                 initial={{ opacity: 0 }}
                 animate={{ opacity: 1 }}
                 className="bg-slate-900/60 backdrop-blur-xl border border-slate-800 shadow-sm rounded-2xl p-5"
              >
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-slate-300 font-bold flex items-center text-xs uppercase tracking-widest mb-1">
                    <FiActivity className="mr-2 text-cyan-500 text-sm" /> Credibility Trend
                  </h3>
                </div>
                <div className="h-40 w-full relative">
                  <Line data={chartConfig} options={chartOptions} />
                </div>
              </motion.div>
            )}

            {/* History Panel Logs */}
            {history.length > 0 && (
              <motion.div 
                 initial={{ opacity: 0 }}
                 animate={{ opacity: 1 }}
                 className="bg-slate-900/60 backdrop-blur-xl border border-slate-800 shadow-sm rounded-2xl p-5"
              >
                <div className="flex items-center justify-between mb-5">
                  <h3 className="text-slate-300 font-bold flex items-center text-xs uppercase tracking-widest">
                    <FiClock className="mr-2 text-slate-400 text-sm" /> Scan Logs
                  </h3>
                  <button onClick={() => { setHistory([]); localStorage.removeItem('fakeNewsHistory'); }} className="text-[10px] font-mono text-slate-500 hover:text-rose-400 transition-colors uppercase tracking-wider">Flush Logs</button>
                </div>
                <div className="flex flex-col gap-2 max-h-52 overflow-y-auto custom-scrollbar pr-2">
                  {history.map((item, idx) => (
                    <div key={idx} className="bg-slate-950/50 border border-slate-800 rounded-lg p-3 flex items-center justify-between group cursor-pointer hover:border-cyan-900/50 hover:bg-slate-800/50 transition-all font-mono" onClick={() => {
                        setResult(item);
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                      }}>
                       <div className="truncate pr-3 flex-1 flex flex-col justify-center">
                          <p className="text-xs text-slate-300 truncate">{item.contentSource}</p>
                          <p className="text-[10px] text-slate-600 mt-1">{new Date(item.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</p>
                       </div>
                       <span className={`text-[10px] font-bold px-2 py-1 flex-shrink-0 rounded flex items-center uppercase tracking-wider ${item.isFake ? 'bg-rose-950/50 text-rose-400 border border-rose-900/50' : 'bg-emerald-950/50 text-emerald-400 border border-emerald-900/50'}`}>
                         {item.prediction.replace(' News', '')}
                       </span>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </motion.div>

          {/* Right Column: Result Panel Main */}
          <div className="w-full lg:w-[55%] xl:w-[60%] flex flex-col gap-6">
            
            {/* Status Card */}
            <motion.div 
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
              className="bg-slate-900/60 backdrop-blur-xl border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-[0_8px_30px_rgb(0,0,0,0.5)] min-h-[300px] lg:min-h-[400px] flex flex-col relative overflow-hidden"
            >
              <AnimatePresence mode="popLayout">
                {!result && !loading && (
                  <motion.div 
                    key="empty"
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    className="text-slate-500 flex flex-col items-center justify-center h-full text-center py-20"
                  >
                    <div className="w-20 h-20 rounded-2xl bg-slate-800/50 mb-6 flex items-center justify-center border border-slate-700/50 font-mono text-2xl text-slate-600 shadow-inner">
                      [ ]
                    </div>
                    <p className="text-sm font-mono uppercase tracking-widest text-slate-400">System Standby</p>
                    <p className="text-xs font-mono mt-3 text-slate-600 max-w-[260px] leading-relaxed">Awaiting data injection to sequence neural analysis protocols.</p>
                  </motion.div>
                )}

                {loading && (
                  <motion.div 
                    key="loading"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="flex flex-col items-center justify-center h-full py-20"
                  >
                     <div className="relative w-24 h-24 mb-6">
                        <div className="absolute inset-0 border-[4px] border-slate-800 rounded-full"></div>
                        <div className="absolute inset-0 border-[4px] border-cyan-500 rounded-full border-t-transparent animate-spin"></div>
                        <div className="absolute inset-4 border-[2px] border-indigo-500 rounded-full border-b-transparent animate-[spin_2s_linear_infinite_reverse]"></div>
                     </div>
                     <p className="text-cyan-400 text-sm font-mono uppercase tracking-widest animate-pulse">Running Classification Model...</p>
                  </motion.div>
                )}

                {result && !loading && (
                  <motion.div 
                    key="result"
                    initial={{ opacity: 0, scale: 0.8, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    className="w-full flex flex-col"
                  >
                    {/* Image Result Layout */}
                    {result.type === 'image' && (
                      <div className="flex flex-col gap-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                           <div className="bg-slate-950 border border-slate-800 rounded-xl overflow-hidden relative group">
                              <img src={imagePreview} alt="Original" className="w-full h-48 object-cover" />
                              <div className="absolute top-2 left-2 bg-slate-900/80 px-2 py-0.5 rounded text-[10px] font-mono text-slate-400 uppercase tracking-widest border border-slate-700">Source_Buffer</div>
                           </div>
                           <div className="bg-slate-950 border border-slate-800 rounded-xl overflow-hidden relative group">
                              <img src={result.elaImage} alt="ELA Mask" className="w-full h-48 object-cover mix-blend-screen" />
                               <div className="absolute top-2 left-2 bg-indigo-950/80 px-2 py-0.5 rounded text-[10px] font-mono text-cyan-400 uppercase tracking-widest border border-cyan-800">Forensic_ELA_Mask</div>
                               <div className="absolute inset-0 bg-cyan-500/5 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                  <FiEye className="text-2xl text-cyan-400 drop-shadow-[0_0_8px_rgba(6,182,212,0.8)]" />
                               </div>
                            </div>
                        </div>

                        {/* Explicit Image Classification Badge */}
                        <div className="flex justify-center">
                           <div className={`px-4 py-2 rounded-xl border-2 font-black text-lg tracking-widest uppercase flex items-center gap-3 shadow-[0_0_20px_rgba(0,0,0,0.3)] ${
                             result.imageType === 'REAL' ? 'bg-emerald-950/30 border-emerald-500/50 text-emerald-400' :
                             result.imageType === 'AI GENERATED' ? 'bg-amber-950/30 border-amber-500/50 text-amber-400' :
                             'bg-rose-950/30 border-rose-500/50 text-rose-400'
                           }`}>
                             <div className={`w-3 h-3 rounded-full animate-pulse ${
                               result.imageType === 'REAL' ? 'bg-emerald-400 shadow-[0_0_10px_#10b981]' :
                               result.imageType === 'AI GENERATED' ? 'bg-amber-400 shadow-[0_0_10px_#f59e0b]' :
                               'bg-rose-400 shadow-[0_0_10px_#f43f5e]'
                             }`}></div>
                             {result.imageType}
                           </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                           <div className="bg-slate-950/50 p-4 rounded-xl border border-slate-800">
                             <p className="text-[10px] font-mono text-slate-500 uppercase mb-2">Image Integrity</p>
                             <div className="flex items-end gap-2">
                               <span className={`text-2xl font-bold ${result.isTampered ? 'text-rose-500' : 'text-emerald-500'}`}>{result.integrity}%</span>
                               <span className="text-[10px] font-mono text-slate-600 mb-1">{result.isTampered ? 'MODIFIED' : 'SECURE'}</span>
                             </div>
                           </div>
                           <div className="bg-slate-950/50 p-4 rounded-xl border border-slate-800">
                             <p className="text-[10px] font-mono text-slate-500 uppercase mb-2">AI Generation Probability</p>
                             <div className="flex items-end gap-2">
                               <span className={`text-2xl font-bold ${result.aiProb > 50 ? 'text-amber-500' : 'text-cyan-500'}`}>{result.aiProb}%</span>
                               <span className="text-[10px] font-mono text-slate-600 mb-1">PROBABILITY</span>
                             </div>
                           </div>
                        </div>

                        {/* OCR Veracity Panel */}
                        {result.ocrText && (
                           <div className="bg-slate-950/50 p-5 rounded-xl border border-slate-800">
                              <div className="flex items-center justify-between mb-4">
                                 <h3 className="text-[11px] font-mono text-slate-500 uppercase tracking-widest flex items-center">
                                   <FiFileText className="mr-2 text-indigo-400"/> OCR Content Veracity
                                 </h3>
                                 <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${result.isFake ? 'bg-rose-950/50 text-rose-500 border border-rose-900/50' : 'bg-emerald-950/50 text-emerald-500 border border-emerald-900/50'}`}>
                                   {result.prediction}
                                 </span>
                              </div>
                              <p className="text-xs text-slate-400 font-mono italic leading-relaxed mb-4 bg-slate-900/50 p-3 rounded border border-slate-800">
                                 "{result.ocrText.substring(0, 200)}..."
                              </p>
                              <div className="w-full bg-slate-800 rounded-full h-1">
                                 <motion.div 
                                    initial={{ width: 0 }}
                                    animate={{ width: `${result.confidence}%` }}
                                    className={`h-full rounded-full ${result.isFake ? 'bg-rose-500' : 'bg-emerald-500'}`}
                                 />
                              </div>
                           </div>
                        )}
                      </div>
                    )}

                    {/* Standard Text/URL Result Badge (moved down) */}
                    {result.type !== 'image' && result.isUrl && result.contentSource && (
                      <div className="self-start mb-6 inline-flex items-center bg-slate-950 border border-slate-800 rounded-md px-3 py-1.5 shadow-sm">
                        <span className="w-2 h-2 rounded-full bg-slate-500 mr-2 animate-pulse"></span>
                        <span className="text-xs font-mono text-slate-400 capitalize">Source Node:</span>
                        <span className="text-xs font-mono font-bold text-slate-300 ml-1.5">{result.contentSource}</span>
                      </div>
                    )}

                    {result.type !== 'image' && (
                      <div className="flex flex-col sm:flex-row items-center sm:items-start justify-between mb-8 text-center sm:text-left">
                        <div className="flex-1">
                          <h2 className={`text-5xl lg:text-6xl font-black uppercase tracking-tighter mb-4 sm:mb-0 ${result.isFake ? 'text-rose-500 drop-shadow-[0_0_15px_rgba(244,63,94,0.4)]' : 'text-cyan-400 drop-shadow-[0_0_15px_rgba(6,182,212,0.4)]'}`}>
                             {result.prediction.replace(' News', '')}
                          </h2>
                          <p className="text-slate-400 font-mono text-sm sm:mt-3 flex items-center justify-center sm:justify-start">
                            <span className="text-slate-500 mr-2">SYS_CONFIDENCE:</span> 
                            <strong className="text-slate-200">{result.confidence}%</strong>
                          </p>
                        </div>
                        
                        <div className={`mt-6 sm:mt-0 w-24 h-24 rounded-xl flex items-center justify-center shrink-0 border ${result.isFake ? 'bg-rose-950/30 border-rose-900/50 shadow-[inset_0_0_20px_rgba(244,63,94,0.1)]' : 'bg-cyan-950/30 border-cyan-900/50 shadow-[inset_0_0_20px_rgba(6,182,212,0.1)]'}`}>
                          <div className="text-center font-mono">
                            <span className={`text-4xl font-bold block leading-none ${result.isFake ? 'text-rose-500' : 'text-cyan-400'}`}>{result.confidence}</span>
                          </div>
                        </div>
                      </div>
                    )}
                    
                    {/* Progress Bar (Only for text/url results) */}
                    {result.type !== 'image' && (
                       <div className="w-full bg-slate-950 rounded-full overflow-hidden mb-6 h-1 shadow-inner relative border border-slate-800">
                          <motion.div 
                            initial={{ width: 0 }}
                            animate={{ width: `${result.confidence}%` }}
                            transition={{ duration: 1, delay: 0.2, ease: "easeOut" }}
                            className={`h-full rounded-full ${
                              result.isFake 
                                ? 'bg-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.8)]' 
                                : 'bg-cyan-400 shadow-[0_0_10px_rgba(6,182,212,0.8)]'
                            }`}
                          />
                       </div>
                    )}
                    
                    {/* Toolbar actions */}
                    <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 mb-8 border-b border-slate-800 pb-8">
                       <button onClick={handleShare} className="w-full py-2 px-3 rounded-lg bg-slate-800 text-slate-300 font-mono text-[11px] uppercase tracking-wider flex items-center justify-center hover:bg-slate-700 transition-colors border border-slate-700">
                         <FiShare2 className="mr-2 text-sm" /> Broadcast
                       </button>
                       <button onClick={handleDownload} className="w-full py-2 px-3 rounded-lg bg-slate-800 text-slate-300 font-mono text-[11px] uppercase tracking-wider flex items-center justify-center hover:bg-slate-700 transition-colors border border-slate-700">
                         <FiDownload className="mr-2 text-sm" /> Export
                       </button>
                       <button onClick={handleReport} className="col-span-2 lg:col-span-1 w-full py-2 px-3 rounded-lg bg-rose-950/30 text-rose-400 font-mono text-[11px] uppercase tracking-wider flex items-center justify-center hover:bg-rose-900/40 transition-colors border border-rose-900/50">
                         <FiFlag className="mr-2 text-sm" /> Dispute
                       </button>
                    </div>

                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-6">
                      {/* AI Explainability Section */}
                      {result.topWords && result.topWords.length > 0 && (
                        <div className="bg-slate-950/50 p-5 rounded-xl border border-slate-800 flex flex-col h-full">
                          <div className="flex items-center justify-between mb-4">
                             <h3 className="text-[11px] font-mono text-slate-500 uppercase tracking-widest flex items-center">
                               <FiAlertTriangle className="mr-2 text-slate-400"/> Linguistic Keys
                             </h3>
                             
                             {/* Educational Tooltip */}
                             <div className="relative group flex items-center shrink-0">
                               <FiInfo className="text-slate-500 hover:text-cyan-400 cursor-help text-base transition-colors" />
                               <div className="absolute bottom-full right-0 lg:-translate-x-1/2 lg:left-1/2 mb-3 w-64 p-3 bg-slate-800 text-slate-200 text-xs font-medium rounded-lg shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-20 leading-relaxed pointer-events-none border border-slate-700">
                                 TF-IDF word vector highlights that heavily influenced the algorithmic classification.
                               </div>
                             </div>
                          </div>

                          <div className="flex flex-wrap gap-2 mt-auto">
                            {result.topWords.map((item, idx) => (
                              <div key={idx} className="bg-slate-900 border border-slate-700 rounded-md px-3 py-1.5 flex items-center space-x-2">
                                <span className="text-sm font-bold text-slate-300">{item.word}</span>
                                <span className={`text-[9px] font-mono mt-0.5 ${result.isFake ? 'text-rose-500' : 'text-cyan-500'}`}>[{(item.score * 10).toFixed(1)}]</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      {/* Cognitive Bias & Manipulation X-Ray */}
                      {result.manipulationMetrics && (
                        <div className="bg-slate-950/50 p-5 rounded-xl border border-slate-800 relative overflow-hidden flex flex-col h-full">
                          <div className="absolute -top-10 -right-10 w-32 h-32 bg-indigo-500/10 rounded-full pointer-events-none blur-2xl"></div>
                          <div className="flex items-center justify-between mb-5 relative z-10">
                             <h3 className="text-[11px] font-mono text-slate-500 uppercase tracking-widest flex items-center">
                               Manipulation X-Ray
                             </h3>
                             
                             <div className="relative group flex items-center shrink-0">
                               <FiInfo className="text-slate-500 hover:text-cyan-400 cursor-help text-base transition-colors" />
                               <div className="absolute bottom-full right-0 lg:-translate-x-1/2 lg:left-1/2 mb-3 w-64 md:w-72 p-3 bg-slate-800 text-slate-200 text-xs font-medium rounded-lg shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-20 leading-relaxed pointer-events-none border border-slate-700">
                                 Heuristic scan detecting psychological tactics. High scores indicate attempts to manipulate emotion over factual reporting.
                               </div>
                             </div>
                          </div>

                          <div className="flex flex-col gap-4 relative z-10 mt-auto">
                            {Object.entries(result.manipulationMetrics).map(([tactic, score], idx) => (
                              <div key={tactic} className="flex flex-col group">
                                <div className="flex justify-between items-end mb-1.5">
                                  <span className="text-[10px] uppercase font-mono text-slate-400">{tactic}</span>
                                  <span className={`text-[10px] font-mono ${score >= 30 ? 'text-rose-400' : 'text-slate-500'}`}>{score} %</span>
                                </div>
                                <div className="h-1 w-full bg-slate-900 rounded-full overflow-hidden flex">
                                  <motion.div 
                                    initial={{ width: 0 }}
                                    animate={{ width: `${score}%` }}
                                    transition={{ duration: 1.2, delay: 0.3 + (idx * 0.1), ease: "easeOut" }}
                                    className={`h-full rounded-full ${
                                      score >= 50 ? 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.6)]' : 
                                      score >= 20 ? 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.6)]' : 
                                      'bg-indigo-500'
                                    }`}
                                  />
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div> {/* End Grid */}

                    {/* Scraped Text Preview (if URL was used) */}
                    {result?.scrapedText && (
                       <motion.div 
                         initial={{ opacity: 0, y: 20 }}
                         animate={{ opacity: 1, y: 0 }}
                         className="bg-slate-950/50 border border-slate-800 rounded-xl p-5 mt-2"
                       >
                         <h3 className="text-slate-500 font-mono mb-3 flex items-center text-[11px] uppercase tracking-widest">
                           Data Payload Preview
                         </h3>
                         <div className="bg-slate-900 rounded-lg p-4 border border-slate-800 shadow-inner relative">
                            <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-cyan-500 to-indigo-500 rounded-l-lg opacity-50"></div>
                            <p className="text-xs text-slate-400 font-mono leading-relaxed line-clamp-[6] pl-2 break-all">
                              {result.scrapedText}
                            </p>
                         </div>
                       </motion.div>
                    )}

                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>

          </div>
        </div>
        
        {/* Footer */}
        <footer className="mt-16 md:mt-24 pt-8 pb-6 border-t border-slate-800/50 text-center text-slate-600 text-[10px] font-mono uppercase tracking-widest w-full">
          <p>TruthLens OS [Build_{new Date().getFullYear()}] // Secure Node Protocol</p>
        </footer>

      </div>

      {/* Global Toast Notification */}
      <AnimatePresence>
        {toast.show && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.9 }}
            className={`fixed bottom-6 right-6 z-50 px-5 py-3 rounded-xl shadow-2xl border font-mono text-xs flex items-center ${
              toast.type === 'success' ? 'bg-emerald-950/80 text-emerald-400 border-emerald-900 shadow-[0_0_20px_rgba(16,185,129,0.2)]' : 'bg-rose-950/80 text-rose-400 border-rose-900 shadow-[0_0_20px_rgba(244,63,94,0.2)]'
            }`}
          >
            {toast.type === 'success' ? <div className="w-2 h-2 rounded-full bg-emerald-400 mr-3 animate-pulse"></div> : <div className="w-2 h-2 rounded-full bg-rose-400 mr-3 animate-pulse"></div>}
            {toast.message}
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}

export default App;
