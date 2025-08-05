### Security Logic Explanation

This module handles two core security pillars for the application: **Password Protection** and **Stateless Authentication via JWT**.

1.  **Password Protection with `bcrypt`**:

    -   **Principle**: We **never** store user passwords in plain text. Instead, we store a secure hash of the password.

    -   **How it Works**: When a user registers, their password is run through the `get_password_hash` function. This function uses the `bcrypt` algorithm, which is a strong, industry-standard hashing function.

    -   **Why `bcrypt` is Secure**:

        -   **One-Way**: Hashing is a one-way process. It's computationally infeasible to reverse the hash to get the original password.

        -   **Salting**: `bcrypt` automatically generates and includes a unique "salt" (a random string) with each password before hashing. This means that even if two users have the same password, their stored hashes will be completely different. This defends against "rainbow table" attacks.

        -   **Slow**: The algorithm is intentionally slow and resource-intensive, which makes "brute-force" attacks (trying millions of password combinations against a stolen hash) extremely time-consuming and costly for an attacker.

2.  **Authentication with Access & Refresh Tokens (JWT)**:

    -   **Principle**: We use JSON Web Tokens (JWT) for stateless authentication. This means the server does not need to keep track of who is logged in. The user proves their identity with every request by presenting a valid token.

    -   **How it Works**:

        -   When a user logs in successfully, the server generates two tokens: a short-lived **Access Token** and a long-lived **Refresh Token**.

        -   **Access Token**: This token is sent with every request to a protected API endpoint. It contains a payload with the user's ID, an expiration date (e.g., 30 minutes), and a digital signature. The server verifies the signature using the `SECRET_KEY` to ensure the token is authentic and has not been tampered with.

        -   **Refresh Token**: Since the Access Token expires quickly, the user would have to log in frequently. The Refresh Token solves this. It has a much longer lifespan (e.g., 7 days). Its **only purpose** is to be exchanged for a new Access Token when the old one expires. It cannot be used to access data.

    -   **Why this Strategy is Secure**:

        -   **Limited Exposure**: If an Access Token is stolen, it's only useful for a very short time, minimizing potential damage.

        -   **Reduced Footprint**: The Refresh Token is used infrequently, reducing its exposure to interception. It's often stored in a more secure location on the client (like an HttpOnly cookie).

        -   **Integrity**: The JWT signature guarantees that the token's payload (e.g., the user ID) has not been altered by anyone after it was issued by the server.