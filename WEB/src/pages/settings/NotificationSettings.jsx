import { useState, useEffect } from "react";
import "./Settings.css";
import Toggle from "../../components/Toggle";
import { eventApi } from "../../api/eventApi";

function NotificationSettings() {
  const [settings, setSettings] = useState({
    motion: true,
    sound: true,
    offline: false,
    reconnect: false,
    vpn: true,
    importantOnly: true
  });

  useEffect(() => {
    let isMounted = true;
    async function getSettings() {
      try {
        const data = await eventApi.getNotificationSettings();
        if (isMounted && data) {
          setSettings((prev) => ({
            ...prev,
            ...data,
          }));
        }
      } catch (err) {
        console.warn("[NotificationSettings] Using default settings:", err.message);
      }
    }
    getSettings();
    return () => {
      isMounted = false;
    };
  }, []);

  async function handleToggle(key) {
    const newValue = !settings[key];
    const updated = {
      ...settings,
      [key]: newValue,
    };

    setSettings(updated);

    try {
      await eventApi.updateNotificationSettings(updated);
    } catch (err) {
      console.warn("[NotificationSettings] Failed to update setting:", err);
    }
  }

  return (
    <div className="settings-section">
      <h2>알림 설정</h2>

      <div className="setting-card">
        <div>
          <strong>움직임 감지 알림</strong>
          <p>움직임 이벤트가 발생하면 알림을 받습니다.</p>
        </div>

        <Toggle
          checked={settings.motion}
          onChange={() => handleToggle("motion")}
        />
      </div>


      <div className="setting-card">
        <div>
          <strong>소리 감지 알림</strong>
          <p>소리 이벤트가 발생하면 알림을 받습니다.</p>
        </div>

        <Toggle
          checked={settings.sound}
          onChange={() => handleToggle("sound")}
        />
      </div>


      <div className="setting-card">
        <div>
          <strong>보드 오프라인 알림</strong>
          <p>보드 연결이 끊어지면 알림을 받습니다.</p>
        </div>

         <Toggle
          checked={settings.offline}
          onChange={() => handleToggle("offline")}
        />
      </div>


      <div className="setting-card">
        <div>
          <strong>보드 재연결 알림</strong>
          <p>오프라인 상태의 보드가 다시 연결되면 알림을 받습니다.</p>
        </div>
        <Toggle
          checked={settings.reconnect}
          onChange={() => handleToggle("reconnect")}
        />
      </div>


      <div className="setting-card">
        <div>
          <strong>VPN 장애 알림</strong>
          <p>VPN 연결에 문제가 발생하면 알림을 받습니다.</p>
        </div>

        <Toggle
          checked={settings.vpn}
          onChange={() => handleToggle("vpn")}
        />
      </div>


      <div className="setting-card">
        <div>
          <strong>중요 이벤트만 알림</strong>
          <p>중요도가 높은 이벤트만 알림으로 표시합니다.</p>
        </div>

        <Toggle
          checked={settings.importantOnly}
          onChange={() => handleToggle("importantOnly")}
        />
      </div>

    </div>
  );
}

export default NotificationSettings;