"""
ML Model Training Script
Trains category (type) and priority models from the tickets dataset.
"""

import pandas as pd
import numpy as np
import re
import joblib
import os
import json
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.svm import LinearSVC
from sklearn.pipeline import Pipeline
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report, accuracy_score
from sklearn.calibration import CalibratedClassifierCV

STOP_WORDS = {
    'the','a','an','and','or','but','in','on','at','to','for','of','with',
    'is','are','was','were','be','been','being','have','has','had','do',
    'does','did','will','would','could','should','may','might','shall',
    'this','that','these','those','i','we','you','he','she','they','it',
    'my','our','your','his','her','their','its','me','us','him','her',
    'dear','customer','support','team','hello','hi','hope','message',
    'reaching','out','please','thank','thanks','regards','sincerely',
    'writing','contact','help','assist','assistance','kind','kindly',
}

def preprocess(text):
    if not isinstance(text, str):
        return ""
    text = text.lower()
    text = re.sub(r'[^a-z0-9\s]', ' ', text)
    text = re.sub(r'\s+', ' ', text).strip()
    tokens = [w for w in text.split() if w not in STOP_WORDS and len(w) > 2]
    return ' '.join(tokens)

def train():
    print("Loading dataset...")
    df = pd.read_csv('data/tickets.csv')
    print(f"Total rows: {len(df)}")

    # Filter English only for better model performance
    df_en = df[df['language'] == 'en'].copy()
    print(f"English rows: {len(df_en)}")

    # Combine subject + body for richer text
    df_en['text'] = (
        df_en['subject'].fillna('') + ' ' +
        df_en['body'].fillna('')
    )
    df_en['text_clean'] = df_en['text'].apply(preprocess)

    # Remove empty
    df_en = df_en[df_en['text_clean'].str.len() > 10]
    df_en = df_en.dropna(subset=['type', 'priority', 'queue'])

    print(f"\nClass distribution - Type:\n{df_en['type'].value_counts()}")
    print(f"\nClass distribution - Priority:\n{df_en['priority'].value_counts()}")
    print(f"\nClass distribution - Queue:\n{df_en['queue'].value_counts()}")

    os.makedirs('models', exist_ok=True)

    # ---- CATEGORY MODEL (type) ----
    print("\nTraining Category (type) model...")
    X_cat = df_en['text_clean']
    y_cat = df_en['type']

    X_train, X_test, y_train, y_test = train_test_split(
        X_cat, y_cat, test_size=0.2, random_state=42, stratify=y_cat
    )

    cat_pipeline = Pipeline([
        ('tfidf', TfidfVectorizer(
            ngram_range=(1, 3),
            max_features=50000,
            sublinear_tf=True,
            min_df=2
        )),
        ('clf', CalibratedClassifierCV(LinearSVC(C=1.0, max_iter=2000), cv=3))
    ])
    cat_pipeline.fit(X_train, y_train)
    y_pred = cat_pipeline.predict(X_test)
    acc = accuracy_score(y_test, y_pred)
    print(f"Category Model Accuracy: {acc:.4f}")
    print(classification_report(y_test, y_pred))
    joblib.dump(cat_pipeline, 'models/category_model.pkl')

    # ---- PRIORITY MODEL ----
    print("\nTraining Priority model...")
    X_pri = df_en['text_clean']
    y_pri = df_en['priority']

    X_train2, X_test2, y_train2, y_test2 = train_test_split(
        X_pri, y_pri, test_size=0.2, random_state=42, stratify=y_pri
    )

    pri_pipeline = Pipeline([
        ('tfidf', TfidfVectorizer(
            ngram_range=(1, 3),
            max_features=50000,
            sublinear_tf=True,
            min_df=2
        )),
        ('clf', CalibratedClassifierCV(
            LinearSVC(C=1.0, max_iter=2000, class_weight='balanced'), cv=3
        ))
    ])
    pri_pipeline.fit(X_train2, y_train2)
    y_pred2 = pri_pipeline.predict(X_test2)
    acc2 = accuracy_score(y_test2, y_pred2)
    print(f"Priority Model Accuracy: {acc2:.4f}")
    print(classification_report(y_test2, y_pred2))
    joblib.dump(pri_pipeline, 'models/priority_model.pkl')

    # ---- QUEUE MODEL ----
    print("\nTraining Queue model...")
    X_q = df_en['text_clean']
    y_q = df_en['queue']

    X_train3, X_test3, y_train3, y_test3 = train_test_split(
        X_q, y_q, test_size=0.2, random_state=42, stratify=y_q
    )

    q_pipeline = Pipeline([
        ('tfidf', TfidfVectorizer(
            ngram_range=(1, 3),
            max_features=50000,
            sublinear_tf=True,
            min_df=2
        )),
        ('clf', CalibratedClassifierCV(
            LinearSVC(C=1.0, max_iter=2000, class_weight='balanced'), cv=3
        ))
    ])
    q_pipeline.fit(X_train3, y_train3)
    y_pred3 = q_pipeline.predict(X_test3)
    acc3 = accuracy_score(y_test3, y_pred3)
    print(f"Queue Model Accuracy: {acc3:.4f}")
    print(classification_report(y_test3, y_pred3))
    joblib.dump(q_pipeline, 'models/queue_model.pkl')

    # Save stats for the dashboard
    stats = {
        'total_training': len(df_en),
        'category_accuracy': round(acc * 100, 1),
        'priority_accuracy': round(acc2 * 100, 1),
        'queue_accuracy': round(acc3 * 100, 1),
        'categories': df_en['type'].value_counts().to_dict(),
        'priorities': df_en['priority'].value_counts().to_dict(),
        'queues': df_en['queue'].value_counts().to_dict(),
        'languages': df['language'].value_counts().to_dict(),
    }
    with open('models/stats.json', 'w') as f:
        json.dump(stats, f, indent=2)

    print("\n✅ All models trained and saved!")
    return stats

if __name__ == '__main__':
    train()
