import { useState, useCallback, useRef, useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import {
  loginCustomer,
  setCurrentCustomer,
  updateCustomerPassword,
  getCustomerById,
} from "../Redux/Slice/customerSlice";
import logo from "../assets/frankoIcon.png";
import {
  LockClosedIcon,
  PhoneIcon,
  EyeIcon,
  EyeSlashIcon,
  ArrowRightIcon,
  ArrowPathIcon,
  ShieldCheckIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
} from "@heroicons/react/24/outline";

// ─── Password rules ──────────────────────────
const PASSWORD_RULES = [
  { id: "length", label: "8+ characters", test: (p) => p.length >= 8 },
  { id: "upper", label: "Uppercase letter", test: (p) => /[A-Z]/.test(p) },
  { id: "lower", label: "Lowercase letter", test: (p) => /[a-z]/.test(p) },
  { id: "number", label: "Number", test: (p) => /\d/.test(p) },
  { id: "symbol", label: "Special character", test: (p) => /[^A-Za-z0-9]/.test(p) },
];

const getStrength = (password) => {
  const passed = PASSWORD_RULES.filter((r) => r.test(password)).length;
  if (passed <= 1) return { score: passed, label: "Very weak", color: "#ef4444" };
  if (passed === 2) return { score: passed, label: "Weak", color: "#f97316" };
  if (passed === 3) return { score: passed, label: "Fair", color: "#eab308" };
  if (passed === 4) return { score: passed, label: "Strong", color: "#22c55e" };
  return { score: passed, label: "Very strong", color: "#15803d" };
};

const isStrongPassword = (p) => PASSWORD_RULES.every((r) => r.test(p));

// ─── Toast Notification ──────────────────────
const Notification = ({ message, type, isVisible, onClose }) => {
  const timerRef = useRef(null);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (isVisible && message) timerRef.current = setTimeout(onClose, 4500);
    return () => clearTimeout(timerRef.current);
  }, [isVisible, message, onClose]);

  if (!isVisible || !message) return null;

  return (
    <div className="am-toast-wrap">
      <div className={`am-toast ${type === "success" ? "am-toast--ok" : "am-toast--err"}`}>
        <div className="am-toast__icon">
          {type === "success" ? (
            <CheckCircleIcon className="am-toast__svg" />
          ) : (
            <ExclamationTriangleIcon className="am-toast__svg" />
          )}
        </div>
        <span className="am-toast__msg">{message}</span>
        <button onClick={onClose} className="am-toast__close" aria-label="Close">
          ✕
        </button>
      </div>
    </div>
  );
};

// ─── Input Field Component ───────────────────
const Field = ({
  icon: Icon,
  label,
  type = "text",
  placeholder,
  name,
  value,
  onChange,
  isPassword,
  onKeyDown,
}) => {
  const [show, setShow] = useState(false);
  const [focused, setFocused] = useState(false);
  const hasValue = value && value.length > 0;

  return (
    <div className={`am-field ${focused ? "am-field--focused" : ""} ${hasValue ? "am-field--filled" : ""}`}>
      <label className="am-field__label">{label || placeholder}</label>
      <div className="am-field__inner">
        <span className="am-field__icon"><Icon /></span>
        <input
          type={isPassword ? (show ? "text" : "password") : type}
          name={name}
          placeholder={placeholder}
          value={value}
          onChange={onChange}
          onKeyDown={onKeyDown}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          className="am-field__input"
          autoComplete={isPassword ? "current-password" : "off"}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setShow((s) => !s)}
            className="am-field__toggle"
            tabIndex={-1}
          >
            {show ? <EyeSlashIcon /> : <EyeIcon />}
          </button>
        )}
      </div>
    </div>
  );
};

// ─── Password Strength Meter ─────────────────
const StrengthMeter = ({ password }) => {
  if (!password) return null;
  const { score, label, color } = getStrength(password);

  return (
    <div className="am-strength">
      <div className="am-strength__header">
        <div className="am-strength__bars">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="am-strength__bar"
              style={{ background: i < score ? color : "#e5e7eb" }}
            />
          ))}
        </div>
        <span className="am-strength__label" style={{ color }}>{label}</span>
      </div>

      <div className="am-strength__rules">
        {PASSWORD_RULES.map((rule) => {
          const ok = rule.test(password);
          return (
            <span key={rule.id} className={`am-strength__rule ${ok ? "am-strength__rule--ok" : ""}`}>
              <span
                className="am-strength__check"
                style={{
                  borderColor: ok ? color : "#d1d5db",
                  background: ok ? color : "transparent",
                }}
              >
                {ok && (
                  <svg viewBox="0 0 12 12" fill="none">
                    <path
                      d="M2.5 6L5 8.5L9.5 3.5"
                      stroke="#fff"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                )}
              </span>
              {rule.label}
            </span>
          );
        })}
      </div>
    </div>
  );
};

// ─── Force Change Password Component ─────────
const ForceChangePasswordPage = ({ customer, onSuccess }) => {
  const dispatch = useDispatch();
  const [form, setForm] = useState({
    oldPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const handle = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const submit = async () => {
    setError("");

    if (!form.oldPassword) return setError("Please enter your current password.");
    if (!isStrongPassword(form.newPassword)) {
      return setError("New password does not meet strength requirements.");
    }
    if (form.newPassword !== form.confirmPassword) {
      return setError("Passwords do not match.");
    }
    if (form.oldPassword === form.newPassword) {
      return setError("New password must differ from current password.");
    }

    setLoading(true);

    try {
      await dispatch(
        updateCustomerPassword({
          contactNumber: customer.contactNumber,
          oldPassword: form.oldPassword,
          newPassword: form.newPassword,
        })
      ).unwrap();

      const updatedProfile = await dispatch(
        getCustomerById({
          contactNumber: customer.contactNumber,
          accessToken: customer.accessToken,
        })
      ).unwrap();

      const completeCustomer = {
        ...updatedProfile,
        accessToken: customer.accessToken,
        refreshToken: customer.refreshToken,
        contactNumber: customer.contactNumber,
        loginStatus: true,
        isAuthenticated: true,
      };

      dispatch(setCurrentCustomer(completeCustomer));

      setDone(true);
      setTimeout(onSuccess, 1500);
    } catch (err) {
      setError(
        typeof err === "object"
          ? err?.message || "Password update failed."
          : err || "Password update failed."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-page__container">
        <div className="auth-page__card">
          <div className="am-force-strip" />
          <div className="am-force-header">
            <div className="am-force-shield">
              <ShieldCheckIcon />
            </div>
            <h3 className="am-force-title">Password Reset Required</h3>
            <p className="am-force-desc">
              Your account requires a password update before you can continue.
            </p>
          </div>

          {done ? (
            <div className="am-force-done">
              <CheckCircleIcon className="am-force-done__icon" />
              <p>Password updated successfully!</p>
            </div>
          ) : (
            <div className="am-force-body">
              {error && <div className="am-force-error">{error}</div>}

              <Field
                icon={LockClosedIcon}
                label="Current Password"
                placeholder="Enter current password"
                name="oldPassword"
                value={form.oldPassword}
                onChange={handle}
                isPassword
              />

              <Field
                icon={LockClosedIcon}
                label="New Password"
                placeholder="Enter new password"
                name="newPassword"
                value={form.newPassword}
                onChange={handle}
                isPassword
              />

              <StrengthMeter password={form.newPassword} />

              <Field
                icon={LockClosedIcon}
                label="Confirm Password"
                placeholder="Confirm new password"
                name="confirmPassword"
                value={form.confirmPassword}
                onChange={handle}
                isPassword
              />

              <button className="am-btn am-btn--primary" onClick={submit} disabled={loading}>
                {loading ? (
                  <>
                    <ArrowPathIcon className="am-spin" /> Updating…
                  </>
                ) : (
                  <>
                    Update Password <ArrowRightIcon />
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ─── Main Auth Page (Sign In Only) ───────────
const AuthPage = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const currentCustomer = useSelector((state) => state.customer?.currentCustomer);

  const [loading, setLoading] = useState(false);
  const [forcePasswordChange, setForcePasswordChange] = useState(false);
  const [pendingCustomer, setPendingCustomer] = useState(null);
  const [notification, setNotification] = useState({
    message: "",
    type: "success",
    isVisible: false,
  });

  const [loginData, setLoginData] = useState({
    contactNumber: "",
    password: "",
  });

  const hideNotif = useCallback(() => {
    setNotification((prev) => ({ ...prev, isVisible: false }));
  }, []);

  const showNotif = useCallback((message, type = "success") => {
    setNotification({ message: "", type, isVisible: false });
    requestAnimationFrame(() => {
      setNotification({ message, type, isVisible: true });
    });
  }, []);

  const normalizePhone = (value = "") => value.replace(/\D/g, "");

  const validateLogin = () => {
    const phone = normalizePhone(loginData.contactNumber);

    if (!phone) {
      showNotif("Contact number is required.", "error");
      return false;
    }

    if (phone.length !== 10) {
      showNotif("Contact number must be 10 digits.", "error");
      return false;
    }

    if (!loginData.password) {
      showNotif("Password is required.", "error");
      return false;
    }

    return true;
  };

  const handleLogin = async () => {
    if (!validateLogin()) return;

    setLoading(true);

    try {
      const result = await dispatch(
        loginCustomer({
          contactNumber: normalizePhone(loginData.contactNumber),
          password: loginData.password,
        })
      ).unwrap();

      if (result?.requiresPasswordChange || result?.loginStatus === false) {
        setPendingCustomer(result);
        setForcePasswordChange(true);
        return;
      }

      if (!result?.accessToken || !result?.contactNumber) {
        showNotif("Login succeeded but customer session is incomplete.", "error");
        return;
      }

      dispatch(setCurrentCustomer(result));

      showNotif("Welcome back!", "success");

      // Redirect to agent dashboard after successful login
      setTimeout(() => {
        navigate("/agent/dashboard");
      }, 1000);
    } catch (err) {
      const message =
        typeof err === "object"
          ? err?.message || "Login failed. Please check your credentials."
          : err || "Login failed. Please check your credentials.";

      showNotif(message, "error");
    } finally {
      setLoading(false);
    }
  };

  const handleKey = (e) => {
    if (e.key === "Enter" && !loading) {
      handleLogin();
    }
  };

  // If force password change is needed
  if (forcePasswordChange && pendingCustomer) {
    return (
      <>
        <style>{STYLES}</style>
        <ForceChangePasswordPage
          customer={pendingCustomer}
          onSuccess={() => {
            setForcePasswordChange(false);
            setPendingCustomer(null);
            showNotif("Password updated! You're now logged in.", "success");
            setTimeout(() => navigate("/agent/dashboard"), 1200);
          }}
        />
      </>
    );
  }

  return (
    <>
      <style>{STYLES}</style>
      <Notification {...notification} onClose={hideNotif} />

      <div className="auth-page">
        <div className="auth-page__container">
          <div className="auth-page__card">
            <header className="am-header">
              <img src={logo} alt="Franko" className="am-logo" />
              <h2 className="am-heading">Welcome back</h2>
              <p className="am-subheading">Sign in to your account</p>
            </header>

            <div className="am-content">
              <div className="am-content__inner">
                <div className="am-form-fields">
                  <Field
                    icon={PhoneIcon}
                    label="Phone Number"
                    placeholder="Enter 10-digit number"
                    name="contactNumber"
                    value={loginData.contactNumber}
                    onChange={(e) =>
                      setLoginData((prev) => ({
                        ...prev,
                        [e.target.name]: e.target.value,
                      }))
                    }
                    onKeyDown={handleKey}
                  />

                  <Field
                    icon={LockClosedIcon}
                    label="Password"
                    placeholder="Enter your password"
                    name="password"
                    value={loginData.password}
                    onChange={(e) =>
                      setLoginData((prev) => ({
                        ...prev,
                        [e.target.name]: e.target.value,
                      }))
                    }
                    isPassword
                    onKeyDown={handleKey}
                  />

                  <button
                    className="am-btn am-btn--primary"
                    onClick={handleLogin}
                    disabled={loading}
                  >
                    {loading ? (
                      <>
                        <ArrowPathIcon className="am-spin" /> Signing in…
                      </>
                    ) : (
                      <>
                        Sign In <ArrowRightIcon />
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default AuthPage;

// ─────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────
const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap');

  :root {
    --am-primary: #14532d;
    --am-primary-hover: #166534;
    --am-accent: #22c55e;
    --am-accent-light: #dcfce7;
    --am-danger: #dc2626;
    --am-warning: #f59e0b;
    --am-text: #111827;
    --am-text-secondary: #6b7280;
    --am-text-tertiary: #9ca3af;
    --am-bg: #ffffff;
    --am-bg-secondary: #f9fafb;
    --am-border: #e5e7eb;
    --am-border-focus: #22c55e;
    --am-radius: 12px;
    --am-radius-sm: 8px;
    --am-shadow-sm: 0 1px 2px rgba(0,0,0,.05);
    --am-shadow: 0 4px 6px -1px rgba(0,0,0,.1), 0 2px 4px -2px rgba(0,0,0,.1);
    --am-shadow-lg: 0 20px 60px -12px rgba(0,0,0,.25);
    --am-font: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    --am-transition: 200ms cubic-bezier(.4,0,.2,1);
  }

  .auth-page {
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 20px;
    background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 50%, #f0fdf4 100%);
    font-family: var(--am-font);
  }

  .auth-page__container {
    width: 100%;
    max-width: 460px;
  }

  .auth-page__card {
    background: var(--am-bg);
    border-radius: var(--am-radius);
    box-shadow: var(--am-shadow-lg), 0 0 0 1px rgba(0,0,0,.05);
    font-family: var(--am-font);
    -webkit-font-smoothing: antialiased;
    overflow: hidden;
  }

  .am-header {
    padding: 32px 28px 0;
    text-align: center;
  }

  .am-logo {
    height: 40px; width: auto;
    margin-bottom: 20px;
    object-fit: contain;
  }

  .am-heading {
    font-size: 24px; font-weight: 800;
    color: var(--am-text);
    margin: 0 0 6px;
    letter-spacing: -.04em;
    line-height: 1.2;
  }

  .am-subheading {
    font-size: 14px; font-weight: 400;
    color: var(--am-text-secondary);
    margin: 0;
    line-height: 1.4;
  }

  .am-content {
    padding: 24px 28px 32px;
  }

  .am-content__inner {
    display: flex; flex-direction: column; gap: 0;
    animation: amContentIn .25s ease;
  }

  @keyframes amContentIn {
    from { opacity: 0; transform: translateY(6px) }
    to { opacity: 1; transform: translateY(0) }
  }

  .am-form-fields {
    display: flex; flex-direction: column; gap: 16px;
  }

  .am-field {
    display: flex; flex-direction: column; gap: 6px;
  }

  .am-field__label {
    font-size: 13px; font-weight: 600;
    color: var(--am-text-secondary);
    letter-spacing: -.01em;
    font-family: var(--am-font);
    padding-left: 2px;
  }

  .am-field--focused .am-field__label { color: var(--am-primary); }

  .am-field__inner {
    display: flex; align-items: center;
    border: 1.5px solid var(--am-border);
    border-radius: var(--am-radius-sm);
    height: 50px;
    overflow: hidden;
    transition: all var(--am-transition);
    background: var(--am-bg);
  }

  .am-field--focused .am-field__inner {
    border-color: var(--am-border-focus);
    box-shadow: 0 0 0 3px rgba(34,197,94,.1);
  }

  .am-field__icon {
    width: 46px; min-width: 46px;
    display: flex; align-items: center; justify-content: center;
    color: var(--am-text-tertiary);
    transition: color var(--am-transition);
  }

  .am-field__icon svg { width: 18px; height: 18px; }

  .am-field--focused .am-field__icon { color: var(--am-accent); }

  .am-field__input {
    flex: 1; border: none; outline: none;
    background: transparent;
    font-size: 15px; font-weight: 450;
    color: var(--am-text);
    height: 100%;
    padding-right: 12px;
    font-family: var(--am-font);
    min-width: 0;
  }

  .am-field__input::placeholder {
    color: var(--am-text-tertiary);
    font-weight: 400;
  }

  .am-field__toggle {
    width: 44px; min-width: 44px; height: 100%;
    display: flex; align-items: center; justify-content: center;
    border: none; background: none;
    cursor: pointer;
    color: var(--am-text-tertiary);
    transition: color var(--am-transition);
  }

  .am-field__toggle svg { width: 18px; height: 18px; }
  .am-field__toggle:hover { color: var(--am-text); }

  .am-strength {
    padding: 2px 0 4px;
  }

  .am-strength__header {
    display: flex; align-items: center; gap: 10px;
    margin-bottom: 8px;
  }

  .am-strength__bars {
    display: flex; gap: 3px; flex: 1;
  }

  .am-strength__bar {
    flex: 1; height: 4px;
    border-radius: 99px;
    transition: background .3s ease;
  }

  .am-strength__label {
    font-size: 11px; font-weight: 700;
    font-family: var(--am-font);
    white-space: nowrap;
  }

  .am-strength__rules {
    display: flex; flex-wrap: wrap; gap: 6px 12px;
  }

  .am-strength__rule {
    display: flex; align-items: center; gap: 5px;
    font-size: 11px; font-weight: 450;
    color: var(--am-text-tertiary);
    font-family: var(--am-font);
    transition: color .2s;
  }

  .am-strength__rule--ok { color: var(--am-text); }

  .am-strength__check {
    width: 14px; height: 14px;
    border-radius: 50%;
    border: 1.5px solid #d1d5db;
    display: flex; align-items: center; justify-content: center;
    flex-shrink: 0;
    transition: all .2s;
  }

  .am-strength__check svg { width: 9px; height: 9px; }

  .am-btn {
    width: 100%; height: 50px;
    display: flex; align-items: center; justify-content: center; gap: 8px;
    border: none; border-radius: var(--am-radius-sm);
    font-size: 15px; font-weight: 700;
    cursor: pointer;
    transition: all var(--am-transition);
    font-family: var(--am-font);
    letter-spacing: -.01em;
    margin-top: 4px;
  }

  .am-btn svg { width: 18px; height: 18px; }

  .am-btn--primary {
    background: linear-gradient(135deg, var(--am-primary) 0%, #166534 100%);
    color: #fff;
    box-shadow: 0 2px 8px rgba(20,83,45,.3), inset 0 1px 0 rgba(255,255,255,.1);
  }

  .am-btn--primary:hover:not(:disabled) {
    background: linear-gradient(135deg, #166534 0%, #14532d 100%);
    box-shadow: 0 4px 14px rgba(20,83,45,.4);
    transform: translateY(-1px);
  }

  .am-btn--primary:active:not(:disabled) {
    transform: translateY(0) scale(.995);
    box-shadow: 0 1px 4px rgba(20,83,45,.25);
  }

  .am-btn--primary:disabled {
    opacity: .6; cursor: not-allowed; transform: none;
  }

  .am-spin {
    width: 18px; height: 18px;
    animation: amSpin .7s linear infinite;
  }

  @keyframes amSpin { to { transform: rotate(360deg) } }

  .am-toast-wrap {
    position: fixed; top: 20px; left: 50%;
    transform: translateX(-50%);
    z-index: 99999;
    width: calc(100% - 32px);
    max-width: 420px;
    animation: amToastIn .35s cubic-bezier(.16,1,.3,1);
    pointer-events: none;
  }

  @keyframes amToastIn {
    from { opacity: 0; transform: translateX(-50%) translateY(-14px) scale(.96) }
    to { opacity: 1; transform: translateX(-50%) translateY(0) scale(1) }
  }

  .am-toast {
    display: flex; align-items: center; gap: 10px;
    padding: 14px 16px;
    border-radius: var(--am-radius);
    box-shadow: 0 12px 40px rgba(0,0,0,.18);
    font-family: var(--am-font);
    pointer-events: all;
  }

  .am-toast--ok { background: linear-gradient(135deg, #14532d, #166534); color: #fff; }
  .am-toast--err { background: linear-gradient(135deg, #dc2626, #b91c1c); color: #fff; }
  .am-toast__icon { flex-shrink: 0; }
  .am-toast__svg { width: 20px; height: 20px; color: rgba(255,255,255,.9); }
  .am-toast__msg { flex: 1; font-size: 13px; font-weight: 500; line-height: 1.4; }

  .am-toast__close {
    flex-shrink: 0; width: 24px; height: 24px;
    border-radius: 6px;
    border: none; background: rgba(255,255,255,.15);
    color: #fff;
    display: flex; align-items: center; justify-content: center;
    cursor: pointer; transition: background .15s;
  }

  .am-toast__close svg { width: 14px; height: 14px; }
  .am-toast__close:hover { background: rgba(255,255,255,.3); }

  .am-force-strip {
    height: 4px;
    background: linear-gradient(90deg, var(--am-primary), var(--am-accent), var(--am-primary));
    background-size: 200%;
    animation: amStrip 2.5s ease infinite alternate;
  }

  @keyframes amStrip {
    from { background-position: 0% }
    to { background-position: 100% }
  }

  .am-force-header { padding: 28px 28px 20px; text-align: center; }

  .am-force-shield {
    width: 56px; height: 56px; border-radius: 14px;
    background: linear-gradient(135deg, var(--am-accent-light), #f0fdf4);
    border: 2px solid #bbf7d0;
    display: flex; align-items: center; justify-content: center;
    margin: 0 auto 16px;
  }

  .am-force-shield svg { width: 28px; height: 28px; color: var(--am-primary); }
  .am-force-title { font-size: 20px; font-weight: 800; color: var(--am-text); margin: 0 0 6px; letter-spacing: -.03em; }
  .am-force-desc { font-size: 13.5px; color: var(--am-text-secondary); margin: 0; line-height: 1.5; }

  .am-force-body { padding: 0 28px 28px; display: flex; flex-direction: column; gap: 14px; }

  .am-force-error {
    background: #fef2f2; border: 1px solid #fecaca;
    border-radius: var(--am-radius-sm);
    padding: 12px 16px;
    font-size: 13px; color: var(--am-danger);
    line-height: 1.4; font-family: var(--am-font);
  }

  .am-force-done {
    display: flex; flex-direction: column; align-items: center;
    padding: 36px 28px; gap: 14px; text-align: center;
  }

  .am-force-done__icon { width: 56px; height: 56px; color: var(--am-accent); }
  .am-force-done p { font-size: 16px; font-weight: 700; color: var(--am-text); margin: 0; font-family: var(--am-font); }

  @media (max-width: 640px) {
    .auth-page {
      align-items: flex-end;
      padding: 0;
      background: var(--am-bg-secondary);
    }

    .auth-page__container {
      max-width: 100%;
    }

    .auth-page__card {
      border-radius: 20px 20px 0 0;
      box-shadow: 0 -4px 20px rgba(0,0,0,.1);
    }

    .am-header { padding: 24px 20px 0; }
    .am-logo { height: 36px; margin-bottom: 16px; }
    .am-heading { font-size: 22px; }
    .am-subheading { font-size: 13px; }

    .am-content { padding: 20px 20px 32px; }
    .am-form-fields { gap: 14px; }

    .am-field__label { font-size: 12px; }
    .am-field__inner { height: 52px; }
    .am-field__icon { width: 48px; min-width: 48px; }
    .am-field__icon svg { width: 20px; height: 20px; }
    .am-field__input { font-size: 16px; }

    .am-btn { height: 52px; font-size: 16px; border-radius: var(--am-radius); }
    .am-btn svg { width: 20px; height: 20px;  }

    .am-toast-wrap {
      top: auto; bottom: 20px;
      width: calc(100% - 24px);
    }

    @keyframes amToastIn {
      from { opacity: 0; transform: translateX(-50%) translateY(14px) scale(.96) }
      to { opacity: 1; transform: translateX(-50%) translateY(0) scale(1) }
    }
  }

  @media (min-width: 641px) {
    .auth-page__card { border-radius: 16px; }
    .am-field__inner:hover:not(:focus-within) {
      border-color: #d1d5db;
    }
  }
`;