import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { buildApiUrl } from '../../config/api';

function decodeSegment(value) {
  try {
    return decodeURIComponent(value || '').trim();
  } catch {
    return String(value || '').trim();
  }
}

function uniqueValues(values) {
  return Array.from(new Set(values.map((value) => decodeSegment(value)).filter(Boolean)));
}

function isLikelyJwt(value) {
  const trimmed = decodeSegment(value);
  const parts = trimmed.split('.');
  return parts.length === 3 && parts[0].startsWith('eyJ');
}

function readFromSearch(search) {
  const params = new URLSearchParams(search);
  return {
    idTokenCandidates: uniqueValues([
      params.get('idToken') || '',
      params.get('token') || '',
      params.get('accessToken') || '',
      params.get('id_token') || '',
    ]),
    authHashCandidates: uniqueValues([
      params.get('authHash') || '',
      params.get('hash') || '',
    ]),
    userIdCandidates: uniqueValues([
      params.get('userId') || '',
      params.get('uid') || '',
      params.get('intraverseUserId') || '',
    ]),
    clientKeyCandidates: uniqueValues([
      params.get('clientKey') || '',
    ]),
  };
}

function readFromPath(pathname) {
  const parts = pathname.split('/').filter(Boolean);
  const callbackIndex = parts.lastIndexOf('callback');
  if (callbackIndex < 0) {
    return {
      idTokenCandidates: [],
      authHashCandidates: [],
      userIdCandidates: [],
    };
  }

  const callbackTail = parts.slice(callbackIndex + 1).map((part) => decodeSegment(part));
  if (!callbackTail.length) {
    return {
      idTokenCandidates: [],
      authHashCandidates: [],
      userIdCandidates: [],
    };
  }

  const jwtLikeSegments = callbackTail.filter((part) => isLikelyJwt(part));
  const callbackTailWithoutLast = callbackTail.length > 1
    ? callbackTail.slice(0, -1).join('/')
    : '';
  const secondSegment = callbackTail[1] || '';
  const lastSegment = callbackTail[callbackTail.length - 1] || '';
  const authHashCandidate = secondSegment && !isLikelyJwt(secondSegment) ? secondSegment : '';
  const userIdCandidate =
    lastSegment &&
    !isLikelyJwt(lastSegment) &&
    lastSegment !== authHashCandidate
      ? lastSegment
      : '';

  return {
    idTokenCandidates: uniqueValues([
      ...jwtLikeSegments,
      callbackTailWithoutLast,
      callbackTail.join('/'),
      callbackTail[0] || '',
    ]),
    authHashCandidates: uniqueValues([
      authHashCandidate,
    ]),
    userIdCandidates: uniqueValues([
      userIdCandidate,
    ]),
  };
}

async function readResponsePayload(response) {
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    return response.json();
  }

  const text = await response.text();
  return text ? { message: text } : {};
}

function getStoredIntraverseContext() {
  return {
    pendingAuthHash: decodeSegment(localStorage.getItem('intraversePendingAuthHash') || ''),
    clientKey: decodeSegment(localStorage.getItem('intraverseClientKey') || ''),
    magicLoginUrl: decodeSegment(localStorage.getItem('intraverseMagicLoginUrl') || ''),
  };
}

function persistIntraverseSession(data) {
  const intraverseUserId = String(data?.intraverseUserId || '').trim();
  if (!intraverseUserId) {
    return false;
  }

  localStorage.removeItem('intraverseIdToken');
  localStorage.removeItem('intraversePendingAuthHash');
  localStorage.removeItem('intraverseClientKey');
  localStorage.removeItem('intraverseMagicLoginUrl');
  localStorage.setItem('intraverseUserId', intraverseUserId);
  localStorage.setItem('walletConnected', 'true');
  if (data?.walletAddress) {
    localStorage.setItem('walletAddress', String(data.walletAddress));
  }
  if (data?.token) {
    localStorage.setItem('token', String(data.token));
    localStorage.setItem('ZGJwt', String(data.token));
  }
  if (data?.Intraverse) {
    localStorage.setItem('Intraverse', JSON.stringify(data.Intraverse));
  } else {
    localStorage.setItem('Intraverse', JSON.stringify({
      userId: intraverseUserId,
      userName: data?.user?.name || '',
    }));
  }
  if (data?.user) {
    localStorage.setItem('intraverseUserInfo', JSON.stringify(data.user));
  }
  window.dispatchEvent(new Event('intraverse-user-saved'));
  return true;
}

export default function IntraverseLogin() {
  const location = useLocation();
  const navigate = useNavigate();
  const [statusText, setStatusText] = useState('Signing in to Intraverse...');
  const [errorText, setErrorText] = useState('');

  const callbackData = useMemo(() => {
    const pathCandidates = readFromPath(location.pathname);
    const queryCandidates = readFromSearch(location.search);
    const storedContext = getStoredIntraverseContext();

    return {
      idTokenCandidates: uniqueValues([
        ...queryCandidates.idTokenCandidates,
        ...pathCandidates.idTokenCandidates,
      ]),
      authHashCandidates: uniqueValues([
        ...queryCandidates.authHashCandidates,
        ...pathCandidates.authHashCandidates,
        storedContext.pendingAuthHash,
      ]),
      userIdCandidates: uniqueValues([
        ...queryCandidates.userIdCandidates,
        ...pathCandidates.userIdCandidates,
      ]),
      clientKeyCandidates: uniqueValues([
        ...queryCandidates.clientKeyCandidates,
        storedContext.clientKey,
      ]),
      pendingAuthHash: storedContext.pendingAuthHash,
      magicLoginUrl: storedContext.magicLoginUrl,
    };
  }, [location.pathname, location.search]);

  useEffect(() => {
    let cancelled = false;

    const finalize = async () => {
      try {
        setErrorText('');

        if (!callbackData.idTokenCandidates.length) {
          if (!cancelled) {
            setStatusText('Intraverse login could not be completed.');
            setErrorText('No callback token was found in the Intraverse redirect URL.');
          }
          console.warn('[intraverse] callback loaded but no auth values found in URL');
          return;
        }

        let loginSucceeded = false;
        let lastErrorMessage = '';

        for (const [index, idToken] of callbackData.idTokenCandidates.entries()) {
          try {
            if (cancelled) return;

            setStatusText(
              callbackData.idTokenCandidates.length > 1
                ? `Completing Intraverse login (${index + 1}/${callbackData.idTokenCandidates.length})...`
                : 'Completing Intraverse login...'
            );

            const payload = {
              idToken,
              token: idToken,
              authHash: callbackData.authHashCandidates[0] || '',
              pendingAuthHash: callbackData.pendingAuthHash || '',
              clientKey: callbackData.clientKeyCandidates[0] || '',
              userId: callbackData.userIdCandidates[0] || '',
              intraverseUserId: callbackData.userIdCandidates[0] || '',
              callbackPath: location.pathname,
              callbackSearch: location.search,
              magicLoginUrl: callbackData.magicLoginUrl || '',
            };

            const response = await fetch(buildApiUrl('/intraverse/auth/user-login'), {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload),
            });
            const data = await readResponsePayload(response);

            if (response.ok && persistIntraverseSession(data)) {
              loginSucceeded = true;
              break;
            }

            lastErrorMessage = String(
              data?.message ||
              data?.error ||
              data?.details ||
              'Intraverse login failed.'
            );

            console.warn('[intraverse] user-login failed for callback candidate', {
              candidateIndex: index,
              candidateCount: callbackData.idTokenCandidates.length,
              tokenLength: typeof idToken === 'string' ? idToken.length : String(idToken).length,
              ok: response.ok,
              authHashLength: typeof payload.authHash === 'string' ? payload.authHash.length : 0,
              userIdLength: typeof payload.userId === 'string' ? payload.userId.length : 0,
              clientKeyLength: typeof payload.clientKey === 'string' ? payload.clientKey.length : 0,
              message: lastErrorMessage,
            });
          } catch (candidateError) {
            lastErrorMessage = String(candidateError?.message || candidateError || 'Intraverse login request failed.');
            console.error('[intraverse] user-login request failed for callback candidate', {
              candidateIndex: index,
              candidateCount: callbackData.idTokenCandidates.length,
              tokenLength: typeof idToken === 'string' ? idToken.length : String(idToken).length,
              error: candidateError,
            });
          }
        }

        if (!loginSucceeded) {
          if (!cancelled) {
            setStatusText('Intraverse login could not be completed.');
            setErrorText(lastErrorMessage || 'Please try the Intraverse login again.');
          }
          console.warn('[intraverse] no callback token candidate succeeded', {
            candidateCount: callbackData.idTokenCandidates.length,
            pathname: location.pathname,
          });
          return;
        }

        if (!cancelled) {
          setStatusText('Intraverse login complete. Redirecting...');
          navigate('/', { replace: true });
        }
      } catch (error) {
        if (!cancelled) {
          setStatusText('Intraverse login could not be completed.');
          setErrorText(String(error?.message || error || 'Please try the Intraverse login again.'));
        }
        console.error('[intraverse] user-login request failed', error);
      }
    };

    void finalize();

    return () => {
      cancelled = true;
    };
  }, [callbackData, location.pathname, location.search, navigate]);

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        padding: '24px',
        background: '#0b1220',
        color: '#f8fafc',
        textAlign: 'center',
      }}
    >
      <div style={{ maxWidth: 520 }}>
        <h1 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '12px' }}>
          {statusText}
        </h1>
        {errorText ? (
          <>
            <p style={{ color: '#fca5a5', lineHeight: 1.6, marginBottom: '16px' }}>
              {errorText}
            </p>
            <button
              type="button"
              onClick={() => navigate('/', { replace: true })}
              style={{
                padding: '12px 18px',
                borderRadius: '10px',
                border: '1px solid rgba(148, 163, 184, 0.35)',
                background: 'rgba(15, 23, 42, 0.9)',
                color: '#f8fafc',
                cursor: 'pointer',
              }}
            >
              Back to Home
            </button>
          </>
        ) : (
          <p style={{ color: '#cbd5e1', lineHeight: 1.6 }}>
            Please wait while we finish your Intraverse sign-in.
          </p>
        )}
      </div>
    </div>
  );
}
