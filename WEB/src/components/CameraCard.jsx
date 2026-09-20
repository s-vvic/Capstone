//카메라 한 대 화면
import { useState } from "react";
import "./CameraCard.css";
import { FiMoreHorizontal } from "react-icons/fi";
import { useFloating, offset, flip, shift, autoUpdate, useClick, useDismiss, useInteractions } from "@floating-ui/react";
import { useNavigate } from "react-router-dom";

function CameraCard({ camera }) {

  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const navigate = useNavigate();

  const {refs, floatingStyles, context} = useFloating({
    open: isDetailOpen,
    onOpenChange: setIsDetailOpen,

    placement: "bottom-end",
    whileElementsMounted: autoUpdate,
    
    middleware: [
      offset(8),
      flip(),
      shift({padding: 10 }),
    ],
  });

  const click = useClick(context);

  const dismiss = useDismiss(context, {
    outsidePress: true,
    escapeKey: true,
  });

  const {
    getReferenceProps,
    getFloatingProps,
  } = useInteractions([click, dismiss]);

  return (
    <article className="camera-card">
      <div 
        className="camera-video"
        onClick={() => navigate(`/Monitoring/${camera.id}`)}
      >
          Video ...
      </div>

      <div className="camera-info">
        <div className="camera-name-group">
          <strong className="name">{camera.name}</strong>
          <br />
          <span className={`status ${camera.status}`}>{camera.status}</span>
        </div>
        </div>
        
        {isDetailOpen && (
          <div 
            ref={refs.setFloating}
            className="detail-popover"
            style={floatingStyles}
            {...getFloatingProps()}
          >
              <div className="popover-header">
                <strong>{camera.name}</strong>
              </div>

            <div className="popover-content">
              <p>카메라 ID : {camera.id}
                <br />
                카메라 IP : {camera.ip}
                <br />
                상태 : {camera.status}
                <br />
                기기 번호 : {camera.hwnum}
              </p>
            </div>
          </div>
        )}
    </article>
  );
}

export default CameraCard;
