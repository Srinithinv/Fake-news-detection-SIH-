import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score
import pickle
import os

print("Starting model training pipeline...")

# 1. Synthesize a dataset for robust testing
print("Creating a synthetic fake news dataset for training...")

# Generate some real-sounding and fake-sounding headlines
real_texts = [
    "The Federal Reserve announced a new 0.25% interest rate hike today to combat inflation.",
    "Scientists have discovered a new species of frog in the Amazon rainforest.",
    "The local city council passed a bill to increase funding for public schools.",
    "Apple is expected to release a new iPhone model in the fall.",
    "A study shows that regular exercise improves cardiovascular health.",
    "Global markets rallied today following positive jobs data from the labor department.",
    "The space agency launched a new satellite to monitor climate change.",
    "A joint military exercise was conducted by allied nations in the Pacific region.",
    "The tech giant reported quarterly earnings that exceeded Wall Street expectations.",
    "Researchers have developed a new solar panel technology with higher efficiency.",
    "The governor signed a new clean energy act into law this morning.",
    "A major internet outage affected millions of users across the eastern seaboard.",
    "A new vaccine trial is showing promising results against the latest flu strain.",
    "The national football team won the championship match after a tense overtime."
] * 50 # Duplicate to have enough data

fake_texts = [
    "Aliens have landed in New York City and are currently negotiating with the mayor!",
    "Drinking bleach cures all known diseases, according to a hidden government document.",
    "The earth is actually flat, and NASA has been lying to us for decades.",
    "Secret billionaire cabal is controlling the weather using giant space lasers.",
    "New study proves that vaccines turn children into cyborgs controlled by 5G networks.",
    "Famous celebrity found alive on a secret island 20 years after faked death.",
    "Local politician caught shape-shifting into a reptilian humanoid during a debate.",
    "Big Pharma is hiding the cure for cancer in a vault under the Pentagon.",
    "The moon landing was filmed on a soundstage in Hollywood by Stanley Kubrick.",
    "Water has memory and can cure illnesses if you speak kindly to it.",
    "Birds aren't real; they are government surveillance drones replacing the real birds.",
    "Drinking raw milk guarantees immunity from the coronavirus, doctors say.",
    "Elvis Presley is managing a diner in rural Kansas, locals confirm.",
    "Scientists claim chocolate cake is actually a vegetable and promotes weight loss."
] * 50 # Duplicate to have enough data

data = []
for text in real_texts:
    data.append({'text': text, 'label': 0}) # 0 = Real
    
for text in fake_texts:
    data.append({'text': text, 'label': 1}) # 1 = Fake

df = pd.DataFrame(data)

# Shuffle the dataframe
df = df.sample(frac=1, random_state=42).reset_index(drop=True)

# 2. Extract Features
X = df['text']
y = df['label']

# 3. Split the Data
print("Splitting data into train/test sets...")
X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

# 4. Feature Extraction (TF-IDF)
print("Vectorizing text data using TF-IDF...")
vectorizer = TfidfVectorizer(stop_words='english', max_df=0.7)
X_train_tfidf = vectorizer.fit_transform(X_train)
X_test_tfidf = vectorizer.transform(X_test)

# 5. Train the Model
print("Training Logistic Regression model...")
model = LogisticRegression(max_iter=1000)
model.fit(X_train_tfidf, y_train)

# 6. Evaluate the Model
y_pred = model.predict(X_test_tfidf)
accuracy = accuracy_score(y_test, y_pred)
print(f"Model Accuracy on Test Set: {accuracy * 100:.2f}%")

# 7. Save the Model and Vectorizer
print("Saving model and vectorizer to disk...")
with open("model.pkl", "wb") as f:
    pickle.dump(model, f)
    
with open("vectorizer.pkl", "wb") as f:
    pickle.dump(vectorizer, f)

print("Pipeline finished successfully! model.pkl and vectorizer.pkl saved.")
