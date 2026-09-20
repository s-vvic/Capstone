import { useEffect, useState } from "react";
import Toggle from "../../components/Toggle";
import "./Settings.css";

function GeneralSettings() {
  const [settings, setSettings] = useState({
    autoRefresh: false,
    showOfflineBoards: true,
    defaultChannel: 4
  });

  useEffect(() => {
    async function getGeneralSettings() {
        try {
            const response = await fetch(
                "/api/general-settings"
            );
            if (!response.ok) {
                throw new Error("일반 설정 정보 조회 실패")
            }

            const data = await response.json();

            setSettings(data);
        } catch (error) {
            console.error(error);
        }
    }
    getGeneralSettings();
  },[]);

  //서버 연결 후에는 삭제
function handleToggle(key) {
  setSettings((prev) => ({
    ...prev,
    [key]: !prev[key]
  }));
}

function handleChannelChange(e) {
  const newChannel = Number(e.target.value);

  setSettings((prev) => ({
    ...prev,
    defaultChannel: newChannel
  }));
}

  /*
  async function handleToggle(key) {
    const newValue = !settings[key];

    setSettings((prev) => ({
        ...prev,
        [key]: newValue
    }));

    try {
        const response = await fetch(
            `/api/general-settings/${key}`,
            {
                method: "PATCH",
                headers: {
                    "Content-Type": "application/json" 
                },
                body: JSON.stringify({
                    value: newValue
                })
            }
        );

        if (!response.ok) {
            throw new Error("설정 업데이트 실패");
        }
    } catch (error) {
        console.error(error);
        setSettings((prev) => ({
            ...prev,
            [key]: !newValue
        }));
    }
  }  */

/*
  async function handleChannelChange(e) {
    const newChannel = Number(e.target.value);
    const oldChannel = settings.defaultChannel;

    setSettings((prev) => ({
        ...prev,
        defaultChannel: newChannel
    }));

    try {
        const response = await fetch(
            "/api/general-settings/defaultChannel",
            {
                method: "PATCH",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    value: newChannel
                })
            }
        );

        if (!response.ok) {
            throw new Error("기본 채널 수 변경 실패");
        }
    } catch (error) {
        console.error(error);
        setSettings((prev) => ({
            ...prev,
            defaultChannel: oldChannel
        }));
    }
  }  */


  return (
    <div className="settings-section">
      <h2>일반 설정</h2>

      <div className="setting-card">
        <div>
          <strong>자동 새로고침</strong>
          <p>보드 상태와 이벤트 정보를 자동으로 갱신합니다.</p>
        </div>

        <Toggle
          checked={settings.autoRefresh}
          onChange={() => handleToggle("autoRefresh")}
        />
      </div>

      <div className="setting-card">
        <div>
          <strong>오프라인 보드 표시</strong>
          <p>멀티뷰와 대시보드에서 오프라인 보드를 표시합니다.</p>
        </div>

        <Toggle
          checked={settings.showOfflineBoards}
          onChange={() => handleToggle("showOfflineBoards")}
        />
      </div>

      <div className="setting-card">
        <div>
          <strong>기본 멀티뷰 채널</strong>
          <p>멀티뷰 진입 시 기본으로 표시할 채널 수입니다.</p>
        </div>

        <select
          value={settings.defaultChannel}
          onChange={handleChannelChange}
        >
          <option value="2">2채널</option>
          <option value="4">4채널</option>
          <option value="8">8채널</option>
        </select>
      </div>
    </div>
  );
}

export default GeneralSettings;