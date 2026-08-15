import React, { useState } from 'react';
import './PlayerProfileCard.css';

const PlayerProfileCard = ({ playerData }) => {
  const [avatarError, setAvatarError] = useState(false);

  if (!playerData) return null;

  const {
    name = 'Warrior',
    walletAddress = '',
    PlayerProfile = {},
    PlayerResources = {},
    PlayerAchievementData = {},
    PlayerGuns = {}
  } = playerData;

  // Get achievements data
  const achievements = [
    {
      label: 'General Killed',
      value: PlayerAchievementData?.KILL_ENEMY_GENERAL?.progress || 0,
      icon: '🎖️'
    },
    {
      label: 'Enemy Killed',
      value: PlayerAchievementData?.KILL_ENEMY?.progress || 0,
      icon: '💀'
    },
    {
      label: 'Tank Destroyed',
      value: PlayerAchievementData?.KILL_ENEMY_TANK?.progress || 0,
      icon: '🔥'
    },
    {
      label: 'Grenade Kills',
      value: PlayerAchievementData?.KILL_ENEMY_BY_GRENADE?.progress || 0,
      icon: '💣'
    }
  ];

  // Get owned guns count
  const ownedGunsCount = Object.keys(PlayerGuns || {}).length;

  // Generate avatar initials
  const avatarInitials = name ? name.slice(0, 2).toUpperCase() : 'WW';

  // Format wallet address
  const formattedAddress = walletAddress 
    ? `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`
    : '';

  return (
    <div className="profile-card-container">
      <div className="profile-card">
        {/* Card Header */}
        <div className="card-header">
          <div className="header-stripe"></div>
          <h2 className="card-title">WARZONE WARRIOR ID</h2>
          <div className="card-number">#{walletAddress.slice(-6).toUpperCase()}</div>
        </div>

        {/* Main Content */}
        <div className="card-content">
          {/* Left Side - Avatar and Info */}
          <div className="profile-left">
            <div className="avatar-container">
              <div className="avatar">
                {!avatarError ? (
                  <img 
                    src={`${import.meta.env.BASE_URL}assets/warrior-avatar.png`}
                    alt="Warrior Avatar"
                    className="avatar-image"
                    onError={() => setAvatarError(true)}
                  />
                ) : (
                  <span className="avatar-text">{avatarInitials}</span>
                )}
              </div>
              <div className="avatar-badge">
                <span>LVL {PlayerProfile?.level || 1}</span>
              </div>
            </div>

            <div className="profile-info">
              <h3 className="warrior-name">{name}</h3>
              <p className="wallet-address">{formattedAddress}</p>
            </div>
          </div>

          {/* Right Side - Stats */}
          <div className="profile-right">
            <div className="resources-grid">
              <div className="resource-item coins">
                <div className="resource-icon">🪙</div>
                <div className="resource-details">
                  <span className="resource-label">Coins</span>
                  <span className="resource-value">{(PlayerResources?.coin || 0).toLocaleString()}</span>
                </div>
              </div>

              <div className="resource-item gems">
                <div className="resource-icon">💎</div>
                <div className="resource-details">
                  <span className="resource-label">Gems</span>
                  <span className="resource-value">{(PlayerResources?.gem || 0).toLocaleString()}</span>
                </div>
              </div>

              <div className="resource-item guns">
                <div className="resource-icon">🔫</div>
                <div className="resource-details">
                  <span className="resource-label">Guns</span>
                  <span className="resource-value">{ownedGunsCount}</span>
                </div>
              </div>

              <div className="resource-item exp">
                <div className="resource-icon">⭐</div>
                <div className="resource-details">
                  <span className="resource-label">EXP</span>
                  <span className="resource-value">{(PlayerProfile?.exp || 0).toLocaleString()}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Achievements Section */}
        <div className="achievements-section">
          <h4 className="achievements-title">
            <span className="title-icon">🏆</span>
            Combat Achievements
          </h4>
          <div className="achievements-grid">
            {achievements.map((achievement, index) => (
              <div key={index} className="achievement-item">
                <div className="achievement-icon">{achievement.icon}</div>
                <div className="achievement-details">
                  <span className="achievement-label">{achievement.label}</span>
                  <span className="achievement-value">{achievement.value.toLocaleString()}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Card Footer */}
        <div className="card-footer">
          <div className="footer-pattern"></div>
          <div className="security-features">
            <div className="hologram"></div>
            <div className="verification-stamp">✓ VERIFIED</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PlayerProfileCard;
