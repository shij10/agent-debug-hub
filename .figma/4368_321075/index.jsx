import React from 'react';

import styles from './index.module.scss';

const Component = () => {
  return (
    <div className={styles.whatSInThis}>
      <div className={styles.autoWrapper}>
        <p className={styles.checkOutTheExamplesB}>
          Check out the examples below. They’re for you to hack up, replicate, and
          make your own.
        </p>
        <img src="../image/mmhtc1oc-u53p6qw.svg" className={styles.vector133} />
      </div>
      <div className={styles.autoWrapper2}>
        <div className={styles.image1} />
        <div className={styles.image2} />
        <div className={styles.image3} />
      </div>
    </div>
  );
}

export default Component;
