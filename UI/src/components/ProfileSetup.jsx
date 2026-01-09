// import React, { useState } from "react";
// import { auth, db } from "../services/firebase";
// import { doc, setDoc } from "firebase/firestore";
// import { useNavigate } from "react-router-dom";

// export default function ProfileSetup() {
//   const [name, setName] = useState("");
//   const [contacts, setContacts] = useState([{ name: "", phone: "" }]);
//   const [questions, setQuestions] = useState([{ question: "", answer: "" }]);
//   const navigate = useNavigate();

//   const uid = auth.currentUser?.uid;

//   const handleAddContact = () => setContacts([...contacts, { name: "", phone: "" }]);
//   const handleAddQuestion = () => setQuestions([...questions, { question: "", answer: "" }]);

//   const handleSubmit = async (e) => {
//     e.preventDefault();
//     if (!uid) return;

//     try {
//       await setDoc(doc(db, "users", uid), {
//         name,
//         contacts,
//         securityQuestions: questions,
//       }, { merge: true });

//       alert("Profile setup successful!");
//       navigate("/dashboard");
//     } catch (err) {
//       alert("Error saving profile: " + err.message);
//     }
//   };

//   return (
//     <div className="container">
//       <h2 className="text-center">👤 Profile Setup</h2>
//       <form onSubmit={handleSubmit}>
//         <label>Full Name</label>
//         <input value={name} onChange={(e) => setName(e.target.value)} required />

//         <h3>Emergency Contacts</h3>
//         {contacts.map((c, i) => (
//           <div key={i}>
//             <input placeholder="Name" value={c.name} onChange={(e) => {
//               const upd = [...contacts];
//               upd[i].name = e.target.value;
//               setContacts(upd);
//             }} />
//             <input placeholder="Phone" value={c.phone} onChange={(e) => {
//               const upd = [...contacts];
//               upd[i].phone = e.target.value;
//               setContacts(upd);
//             }} />
//           </div>
//         ))}
//         <button type="button" className="secondary mt-2" onClick={handleAddContact}>+ Add Contact</button>

//         <h3>Security Questions</h3>
//         {questions.map((q, i) => (
//           <div key={i}>
//             <input placeholder="Question" value={q.question} onChange={(e) => {
//               const upd = [...questions];
//               upd[i].question = e.target.value;
//               setQuestions(upd);
//             }} />
//             <input placeholder="Answer" value={q.answer} onChange={(e) => {
//               const upd = [...questions];
//               upd[i].answer = e.target.value;
//               setQuestions(upd);
//             }} />
//           </div>
//         ))}
//         <button type="button" className="secondary mt-2" onClick={handleAddQuestion}>+ Add Question</button>

//         <button type="submit" className="primary mt-3">Save Profile</button>
//       </form>
//     </div>
//   );
// }
import React, { useState } from "react";
import { auth, db } from "../services/firebase";
import { doc, setDoc } from "firebase/firestore";
import { useNavigate } from "react-router-dom";

export default function ProfileSetup() {
  const [name, setName] = useState("");
  const [contacts, setContacts] = useState([{ name: "", phone: "", chat_id: "" }]); 
  const [questions, setQuestions] = useState([{ question: "", answer: "" }]);
  const navigate = useNavigate();

  const uid = auth.currentUser?.uid;

  const handleAddContact = () =>
    setContacts([...contacts, { name: "", phone: "", chat_id: "" }]);

  const handleAddQuestion = () =>
    setQuestions([...questions, { question: "", answer: "" }]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!uid) return;

    try {
      await setDoc(
        doc(db, "users", uid),
        {
          name,
          contacts, // will include chat_id now
          securityQuestions: questions,
        },
        { merge: true }
      );

      alert("Profile setup successful!");
      navigate("/dashboard");
    } catch (err) {
      alert("Error saving profile: " + err.message);
    }
  };

  return (
    <div className="container">
      <h2 className="text-center">👤 Profile Setup</h2>
      <form onSubmit={handleSubmit}>

        {/* FULL NAME */}
        <label>Full Name</label>
        <input 
          value={name} 
          onChange={(e) => setName(e.target.value)} 
          required 
        />

        {/* CONTACTS */}
        <h3>Emergency Contacts</h3>
        {contacts.map((c, i) => (
          <div key={i} style={{ marginBottom: "10px" }}>
            
            {/* Name */}
            <input
              placeholder="Name"
              value={c.name}
              onChange={(e) => {
                const upd = [...contacts];
                upd[i].name = e.target.value;
                setContacts(upd);
              }}
            />

            {/* Phone */}
            <input
              placeholder="Phone"
              value={c.phone}
              onChange={(e) => {
                const upd = [...contacts];
                upd[i].phone = e.target.value;
                setContacts(upd);
              }}
            />

            {/* CHAT ID (Telegram User ID) */}
            <input
              placeholder="Telegram chat_id"
              value={c.chat_id}
              onChange={(e) => {
                const upd = [...contacts];
                upd[i].chat_id = e.target.value;
                setContacts(upd);
              }}
            />

          </div>
        ))}

        <button
          type="button"
          className="secondary mt-2"
          onClick={handleAddContact}
        >
          + Add Contact
        </button>

        {/* SECURITY QUESTIONS */}
        <h3>Security Questions</h3>
        {questions.map((q, i) => (
          <div key={i}>
            <input
              placeholder="Question"
              value={q.question}
              onChange={(e) => {
                const upd = [...questions];
                upd[i].question = e.target.value;
                setQuestions(upd);
              }}
            />
            <input
              placeholder="Answer"
              value={q.answer}
              onChange={(e) => {
                const upd = [...questions];
                upd[i].answer = e.target.value;
                setQuestions(upd);
              }}
            />
          </div>
        ))}

        <button
          type="button"
          className="secondary mt-2"
          onClick={handleAddQuestion}
        >
          + Add Question
        </button>

        {/* SUBMIT */}
        <button type="submit" className="primary mt-3">
          Save Profile
        </button>
      </form>
    </div>
  );
}
