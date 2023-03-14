import React from 'react'
import { useEffect, useState, useRef} from 'react'
import './index.css';
import io from 'socket.io-client';
const socket = io.connect('http://localhost:3002');
const rtcConfig = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
};
function App() {
  const [userid,setUserid] = useState(0);
  const [seid,setSeid] = useState(0);
  const useridRef = useRef(0);
  const seidRef = useRef(0);
  const screenIdRef = useRef(0);
  const widthRef = useRef(0);
  const heightRef = useRef(0);
  const [userChannelJoined,setUserChannelJoined] = useState(false);
  const [socketMessage,setSocketMessage] = useState("");
  const [showConsentForm,setShowConsentForm] = useState(false);
  const [remoteAccess,setRemoteAccess] = useState(false);
  const [videoStreamActive,setVideoStreamActive] = useState(false);
  const videoRef = useRef();
  const pcRef = useRef(new RTCPeerConnection(rtcConfig));
  let _pc;
  let senderTrack;
  const getStream = async (_pc) => {
    try{
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          mandatory: {
            chromeMediaSource: 'desktop',
            chromeMediaSourceId: screenIdRef.current
          }
        }
      })
      stream.getTracks().forEach((track) => {
        if(senderTrack) senderTrack.replaceTrack(track);
        else senderTrack = _pc.addTrack(track,stream)
      })
      handleStream(stream);
    }
    catch(err){
      console.log(err)
    }
  }

  useEffect(()=>{
    socket.on("remote-access-request", (msg)=>{
      console.log(`Received Access Request from SE : ${msg.userid}`)
      setSeid(msg.userid);
      seidRef.current = msg.userid;
      setShowConsentForm(true);
    })
    socket.on("user-joined",(msg) => {
      if(msg.userid){
        useridRef.current = msg.userid
        setUserChannelJoined(true);
      }
    })
    socket.on("remote-user-joined", async (msg)=>{
      if(msg.seid) {
        setSocketMessage(`SE : ${msg.seid} is online.`)
        setVideoStreamActive(true);
        await startPeerConnection();
        let offer = await createOffer();
        socket.emit("remote-offer",{offer,userid: useridRef.current,seid: msg.seid});
      }
    })
    socket.on("remote-answer", async (msg) => {
      console.log("ANSWER RECEIVED");
      await setRemoteDescriptionFun(msg.answer);
    })
    socket.on("remote-mouse-move", async (msg) => {
      const {clientX,clientY, clientWidth,clientHeight,seid} = msg
      console.log(`${clientX} ${clientY} ${clientWidth} ${clientHeight} from ${seid}`);
      window.electronAPI.setMousePosition({clientX,clientY, ratioX: widthRef.current/clientWidth,ratioY: heightRef.current/clientHeight})
    })
    return () => {
      socket.removeAllListeners();
    }
  },[])

  useEffect(() => {
    window.electronAPI.getScreenId(async (event,{id,width,height}) => {
      screenIdRef.current = id;
      widthRef.current = width
      heightRef.current = height
      console.log(`Selected screen ${id} has width ${width} height ${height}`)
      if(senderTrack){
        console.log(senderTrack);
        _pc.removeTrack(senderTrack);
      }
      await getStream(_pc)
    });
  },[])

  const startPeerConnection = async () => {
    _pc = new RTCPeerConnection(rtcConfig);
    _pc.onicecandidate = (e) => {
      if(e.candidate){
        socket.emit("remote-ice-candidate",{ candidate: JSON.stringify(e.candidate),
          userid: useridRef.current,
          seid: seidRef.current})
        console.log(useridRef.current,seidRef.current)
      }
    }
    _pc.oniceconnectionstatechange = (e) => {
      console.log("ICE Conn State Change : ", e)
    }
    _pc.ontrack = (e) => {
      // receive the video stream
      console.log("Receiving Stream")
    }
    await getStream(_pc,screenIdRef.current);
    pcRef.current = _pc
  }

  const createOffer = async () => {
    try{
      const offerSDP = await pcRef.current.createOffer({
        offerToReceiveVideo: 1,
        offerToReceiveAudio: 1
      })
      //console.log(JSON.stringify(offerSDP));
      pcRef.current.setLocalDescription(offerSDP);
      return JSON.stringify(offerSDP);
    }
    catch(e){
      console.log("Error : ",e)
    }
  }

  const setRemoteDescriptionFun = async (answer) => {
    const answerSDPReceived = JSON.parse(answer);
    console.log("Received SDP : ",answerSDPReceived);
    await pcRef.current.setRemoteDescription(new RTCSessionDescription(answerSDPReceived));
  }

  const handleStream = async (stream) => {
    try {
      // const stream = await navigator.mediaDevices.getDisplayMedia({
      //   audio: false,
      //   video: true
      // })
      //let {width,height} = stream.getVideoTracks()[0].getSettings();
      //window.electronAPI.setSize({width,height})
      if(videoRef.current) {
        videoRef.current.srcObject = stream
        videoRef.current.onloadedmetadata = (e) => videoRef.current.play()
      }
      
    } catch (e) {
      console.log(e)
    }
  }

  const joinUserChannel = () => {
    setUserChannelJoined(true);
    socket.emit("join-user-channel", {userid});
  }

  const sendAccessAck = (res) => {
    setRemoteAccess(res);
    if(!res) {
      seidRef.current = 0;
    }
    socket.emit("remote-access-ack",{res,userid,seid: seidRef.current})
    setShowConsentForm(false);
  }
  return (
    <div className="App">
      <h1>CLIENT WEB APP</h1>
      {
        !userChannelJoined  ? 
          <div style={{display: "flex",flexDirection: "column"}}>
            <label htmlFor='userid'>Enter the userid</label>
            <input id="userid" type="text" placeholder="User ID" onChange={(e)=>{
              setUserid(e.target.value);
              useridRef.current = e.target.value;
            }}></input>
            <button onClick = {joinUserChannel}>Join User Channel</button>
          </div> : <div>User ID : {userid} logged in.</div>
      }

      {showConsentForm ? 
        <div>
          <h1>User {seid} is requesting access.</h1>
          <button style={{backgroundColor: "red"}} onClick={() => sendAccessAck(false)}>Deny</button>
          <button style={{backgroundColor: "green"}} onClick={() => sendAccessAck(true)}>Accept</button>
        </div> : null
      }
      {
        remoteAccess ? 
          <div>
            <h1>You have remote access enabled</h1>
            <h2>SE : {seid} has access</h2>
          </div> : <div>You dont have remote access enabled</div>
      }
      {
        (socketMessage) ? <p>{socketMessage}</p> : null
      }
      {
        videoStreamActive ?
        <div>
          <video ref={videoRef} className="video">video not available</video>
        </div> : null
      }
      <button onClick={()=>{setUserid(0);setUserChannelJoined(false)}}>Logout</button>
    </div> 
  );
}

export default App;
