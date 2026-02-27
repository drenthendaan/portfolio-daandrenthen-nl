import React, { useRef, useState, useEffect } from "react";
import emailjs from "@emailjs/browser";

function ContactForm({ isOpen, onClose }) {
  const form = useRef();
  const [isSending, setIsSending] = useState(false);
  const [status, setStatus] = useState(null);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isOpen]);

  const sendEmail = (e) => {
    e.preventDefault();
    setIsSending(true);
    setStatus(null);

    const SERVICE_ID = "service_2hx4owc";
    const TEMPLATE_ID = "template_c7yl0ur";
    const PUBLIC_KEY = "Qa41KLxuplcNm3aTt";

    emailjs.sendForm(SERVICE_ID, TEMPLATE_ID, form.current, PUBLIC_KEY).then(
      (result) => {
        console.log(result.text);
        setStatus("success");
        setIsSending(false);
        setTimeout(() => {
          onClose();
          setStatus(null);
          e.target.reset();
        }, 2000);
      },
      (error) => {
        console.log(error.text);
        setStatus("error");
        setIsSending(false);
      },
    );
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      ></div>

      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-300">
        <div className="flex justify-between items-center p-6 border-b border-gray-100 bg-gray-50">
          <h3 className="text-xl font-bold text-gray-800">Neem contact op</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-red-500 transition-colors"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>

        <form ref={form} onSubmit={sendEmail} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">
              Naam
            </label>

            <input
              type="text"
              name="user_name"
              required
              className="w-full px-4 py-3 rounded-lg bg-gray-50 border border-gray-200 focus:border-black focus:ring-0 outline-none transition-all"
              placeholder="Je naam"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">
              Email
            </label>
            <input
              type="email"
              name="user_email"
              required
              className="w-full px-4 py-3 rounded-lg bg-gray-50 border border-gray-200 focus:border-black focus:ring-0 outline-none transition-all"
              placeholder="je@email.nl"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">
              Bericht
            </label>
            <textarea
              name="message"
              rows="4"
              required
              className="w-full px-4 py-3 rounded-lg bg-gray-50 border border-gray-200 focus:border-black focus:ring-0 outline-none transition-all resize-none"
              placeholder="Waar kan ik je mee helpen?"
            ></textarea>
          </div>

          {status === "success" && (
            <p className="text-green-600 text-sm font-bold text-center">
              Bericht succesvol verzonden!
            </p>
          )}
          {status === "error" && (
            <p className="text-red-600 text-sm font-bold text-center">
              Er ging iets mis. Probeer het later opnieuw.
            </p>
          )}

          <button
            type="submit"
            disabled={isSending}
            className={`w-full font-bold py-4 rounded-lg transition-all ${
              isSending
                ? "bg-gray-400 cursor-not-allowed text-gray-100"
                : "bg-black text-white hover:bg-gray-800 active:scale-95"
            }`}
          >
            {isSending ? "Versturen..." : "Verstuur bericht"}
          </button>
        </form>
      </div>
    </div>
  );
}

export default ContactForm;
